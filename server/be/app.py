import base64
import datetime
import multiprocessing
import signal
import subprocess
import csv

import os.path
from typing import List

from dateutil.parser import parse
from flask import Flask, request
from flask.json import jsonify
from flask_cors import CORS
from flask_restplus import Resource, Api, fields
from pebble import ProcessPool, ProcessFuture
from werkzeug.exceptions import BadRequest, abort, NotFound, InternalServerError, HTTPException

from be.custom_types import SolverResult, QueueItem
from be.data import DataStore
from be.exceptions import IdRelatedException
from be.graphml_parser import get_nodes_and_edges_from_graph
from be.solver import SolverInterface
from be.utils import get_duplicates

# list to accept as true
# sorry got carried away
yes_list = ("yes", "y", "true", "t", "1", "yep", "aye", "yeah", "yea", "affirmative", "yup", "aye",
            "ay", "accept", "certainly", "surely", "ja", "sirree", "oui", "ya", "sure", "yah", "yeh", "all right",
            "all righty", "42",)

jobs: List[QueueItem] = []


def remove_old_jobs():
    done_jobs = [j for j in jobs if j.future.done()]
    for d in done_jobs:
        jobs.remove(d)


class App:
    """
    This class creates the entry point for the REST interface.
    The entry point will perform the deserialization and serialization .
    Also will the entry point provide some basic sanitation to the given input. Some of the checks are for example:

    * Duplicated ids
    * Graph size withing fairness bounds
    * Structural verification

    """

    #: The path used to store the database file
    data_path = "data.db"

    _k3_str_as_example = "PGdyYXBobWwgeG1sbnM9Imh0dHA6Ly9ncmFwaG1sLmdyYXBoZHJhd2luZy5vcmcveG1sbnMiIHhtbG5zOnhzaT0ia" \
                         "HR0cDovL3d3dy53My5vcmcvMjAwMS9YTUxTY2hlbWEtaW5zdGFuY2UiCiAgICAgICAgIHhzaTpzY2hlbWFMb2NhdG" \
                         "lvbj0iaHR0cDovL2dyYXBobWwuZ3JhcGhkcmF3aW5nLm9yZy94bWxucyBodHRwOi8vZ3JhcGhtbC5ncmFwaGRyYXd" \
                         "pbmcub3JnL3htbG5zLzEuMC9ncmFwaG1sLnhzZCI+CiAgICA8Z3JhcGggZWRnZWRlZmF1bHQ9InVuZGlyZWN0ZWQi" \
                         "PgogICAgICAgIDxub2RlIGlkPSIwIi8+CiAgICAgICAgPG5vZGUgaWQ9IjEiLz4KICAgICAgICA8bm9kZSBpZD0iM" \
                         "iIvPgogICAgICAgIDxlZGdlIHNvdXJjZT0iMCIgdGFyZ2V0PSIxIi8+CiAgICAgICAgPGVkZ2Ugc291cmNlPSIwIi" \
                         "B0YXJnZXQ9IjIiLz4KICAgICAgICA8ZWRnZSBzb3VyY2U9IjEiIHRhcmdldD0iMiIvPgogICAgPC9ncmFwaD4KPC9" \
                         "ncmFwaG1sPg=="

    def create_app(self) -> Flask:
        """
        Initialises the the app and the api object. It adds all the provided endpoints.
        Also does this method define the documentation for the swagger UI and the definitions for the api object
        structure.

        :returns:
            the app object
        """

        # check if lingeling is present
        try:
            subprocess.check_output(["lingeling", "--version"])
        except Exception as e:
            raise Exception("The SAT solver binary could not be called. "
                            "Please make sure that lingeling is build and present in the path.") from e

        app = Flask(__name__)
        if app.config['DEBUG']:
            app.config['PROFILE'] = True
            from werkzeug.middleware.profiler import ProfilerMiddleware
            app.wsgi_app = ProfilerMiddleware(app.wsgi_app, restrictions=[30])
        CORS(app)

        # This lets the child processes ignore the SIG int signal handler.
        original_sigint_handler = signal.signal(signal.SIGINT, signal.SIG_IGN)

        pool: ProcessPool = ProcessPool(max_workers=int(multiprocessing.cpu_count() / 2))

        app.config['RESTPLUS_VALIDATE'] = True

        data_store = DataStore(self.data_path)

        api = Api(app, version='1.0', title='Linear layout API',
                  description='Through this API one can request for a linear layout of a graph in graphml format. \n'
                              'The actual computation of the linear layout is done using SAT solving. '
                              'The instances are solved using [lingeling](http://fmv.jku.at/lingeling/)\n'
                              ''
                              'See https://github.com/linear-layouts/SAT for more information'
                  )

        #: The schema definition of a page
        page_schema = api.model('Page',
                                {
                                    'id': fields.String(required=True, description='The id of this page', example="P1"),
                                    'type': fields.String(description='The type of the page. \n'
                                                                      'NONE allows all patterns',
                                                          enum=['QUEUE',
                                                                'STACK',
                                                                'RIQUE',
                                                                'DEQUE',
                                                                'BIARC',
                                                                'NONE'],
                                                          required=True),
                                    'constraint': fields.String(description='Additional constraints for the page',
                                                                enum=[
                                                                    'NONE',
                                                                    'DISPERSIBLE',
                                                                    'TREE',
                                                                    'FOREST'
                                                                ])
                                })

        #: The schema definition of a constraint
        constraint_schema = api.model('Constraint',
                                      {'type': fields.String(description="""
                                      EDGES_ON_PAGES: assigns edges to specific pages. The edges are encoded 
                                                      independently from each other
                                      arguments: edge ids
                                      modifier: page ids to assign the edges to (OR joined)
                                      
                                      EDGES_SAME_PAGES: assigns edges to the same page. Only implemented up to to 
                                                        four pages
                                      arguments: the edge ids
                                      modifier: none
                                      
                                      EDGES_DIFFERENT_PAGES: all edges have to be on different pages. Only works up to 
                                                             as many edges as there are pages
                                      arguments: the edge ids
                                      modifier none
                                      
                                      NOT_ALL_IN_SAME_PAGE: not all edges can be on the same page. Only works when at least  
                                                            two pages are available
                                      arguments: the edge ids
                                      modifier none
                                      
                                      EDGES_TO_SUB_ARC_ON_PAGES: If any node shares an edge with the nodes named in 
                                                                 arguments and is between the two nodes, then this edge 
                                                                 is restricted to the pages named in modifier.
                                      arguments: the two vertexes to restrict the edges from
                                      modifier: the pages to restrict the edges to
                                      
                                      EDGES_FROM_NODES_ON_PAGES: All edges involving the nodes have to be on the given page. 
                                      arguments: the vertices to restrict the edges from
                                      modifier: the pages to restrict the edges to
                                      
                                      NODES_PREDECESSOR: one set of nodes are before another set of nodes
                                      arguments: the node ids to be before 
                                      modifier: the node ids to be after
                                      
                                      TREAT_GRAPH_DIRECTED: Treat the graph according to direction
                                      
                                      NODES_ABSOLUTE_ORDER: deprecated. see NODES_REQUIRE_ABSOLUTE_ORDER
                                      
                                      NODES_REQUIRE_ABSOLUTE_ORDER: The given nodes have to be in exactly the given 
                                                                    order and no nodes are allowed in between.
                                      arguments: the nodes in the required order
                                      modifier: none 
                                      
                                      NODES_REQUIRE_PARTIAL_ORDER: The given nodes have to be the given relative order
                                      arguments: the nodes in the order
                                      modifier: none 
                                      
                                      NODES_FORBID_PARTIAL_ORDER: The given nodes have to be NOT the given relative order. 
                                                                    Two nodes flipped already satisfy this constraint.
                                      arguments: the nodes in the forbidden order
                                      modifier: none 
                                      
                                      NODES_CONSECUTIVE: The given two nodes have to be next to each other in any order. 
                                                         Currently only implemented for 2 Nodes
                                      arguments: the two nodes to be made consecutive
                                      modifier: none 
                                                             
                                      NODES_NON_CONSECUTIVE: The given two nodes must not be next to each other in any order. 
                                                         Currently only implemented for 2 Nodes
                                      arguments: the two nodes to be made non consecutive
                                      modifier: none                      
                                      
                                      NODES_SET_FIRST: The given node has to be the first in any order.
                                      arguments: the node to be the first
                                      modifier: none 

                                      NODES_SET_NOT_FIRST: The given node has to be the not first in any order.
                                      arguments: the node to be not first
                                      modifier: none 

                                      NODES_SET_LAST: The given node has to be the last in any order.
                                      arguments: the node to be the last
                                      modifier: none 
                                      
                                      NODES_SET_NOT_LAST: The given node has to be not last in any order.
                                      arguments: the node to be not last
                                      modifier: none 
                                      
                                      EDGES_SAME_PAGES_INCIDENT_NODE: All edges incident to this vertex should be on same page.
                                      arguments: the incident node
                                      modifier: none  
                                      
                                      
                                      EDGES_DIFFERENT_PAGES_INCIDENT_NODE: All edges incident to this vertex should be on different pages.
                                      arguments: the incident node
                                      modifier: none  
                                      
                                      
                                      EDGES_ON_PAGES_INCIDENT_NODE: All edges incident to this vertex should be on mentioned pages.
                                      arguments: the incident node
                                      modifier: none  
                                      """,
                                                             enum=[
                                                                 "EDGES_ON_PAGES",
                                                                 "EDGES_SAME_PAGES",
                                                                 "EDGES_DIFFERENT_PAGES",
                                                                 "NOT_ALL_IN_SAME_PAGE",
                                                                 "EDGES_TO_SUB_ARC_ON_PAGES",
                                                                 "EDGES_FROM_NODES_ON_PAGES",
                                                                 "NODES_PREDECESSOR",
                                                                 "TREAT_GRAPH_DIRECTED",
                                                                 "NODES_ABSOLUTE_ORDER",
                                                                 "NODES_REQUIRE_ABSOLUTE_ORDER",
                                                                 "NODES_REQUIRE_PARTIAL_ORDER",
                                                                 "NODES_FORBID_PARTIAL_ORDER",
                                                                 "NODES_CONSECUTIVE",
                                                                 "NODES_NON_CONSECUTIVE",
                                                                 "NODES_SET_FIRST",
                                                                 "NODES_SET_NOT_FIRST",
                                                                 "NODES_SET_LAST",
                                                                 "NODES_SET_NOT_LAST",
                                                                 "EDGES_SAME_PAGES_INCIDENT_NODE",
                                                                 "EDGES_DIFFERENT_PAGES_INCIDENT_NODE",
                                                                 "EDGES_ON_PAGES_INCIDENT_NODE",
                                                                 "EDGES_SET_STACK_ABOVE",
                                                                 "EDGES_SET_STACK_BELOW",
                                                                 "EDGES_SET_BIARC",
                                                                 "EDGES_SET_STACK"
                                                             ],
                                                             example="NODES_PREDECESSOR",
                                                             required=True),
                                       'arguments':
                                           fields.List(fields.String,
                                                       min_items=1, required=True,
                                                       description='The ids of the elements affected by this constraint',
                                                       example=["1"]
                                                       ),
                                       'modifier': fields.List(fields.String,
                                                               description='The ids of the constraint modifier.',
                                                               example=["0"]),
                                       },
                                      )
        assigment_schema = api.model(
            'Assigment',
            {
                'edge': fields.String(description='The id of the edge', required=True),
                'page': fields.String(description='The id of the page the edge is assigned to', required=True)
            })
        error_schema = api.model(
            'Error',
            {
                'message': fields.String(description='The error message', required=True, readonly=True)
            })

        # the schema definition for the full linear layout
        linear_layout_schema = api.model(
            'Linear layout',
            {
                'id': fields.Integer(description='The id of the embedding', readonly=True),
                'graph': fields.String(description='This field contains a graphml definition encoded with base64. '
                                                   'The example value is K3.',
                                       required=True, example=self._k3_str_as_example),
                'pages': fields.List(fields.Nested(page_schema), min_items=1, required=True, unique=True),
                'constraints': fields.List(fields.Nested(constraint_schema)),
                'status': fields.String(description='The current processing status of the computation',
                                        enum=['IN_PROGRESS', 'FINISHED', 'FAILED', 'CANCELLED'], readonly=True),
                'assignments': fields.List(fields.Nested(assigment_schema), readonly=True,
                                           description='A list of edge to page assignments'),
                'vertex_order': fields.List(fields.String, readonly=True,
                                            description='The order in which the vertices have to be placed on the spine.'),
                'satisfiable': fields.Boolean(readonly=True,
                                              description='On finished instances this field indicates if the given '
                                                          'problem is satisfiable'),
                'rawSolverResult': fields.String(readonly=True,
                                                 description='This field contains the comment lines of the solver which '
                                                             'provides some data on the solved SAT instance'),
                'message': fields.String(readonly=True,
                                         description="This field contains currently the error message from "
                                                     "the background processing"),
                'created': fields.DateTime(readonly=True,
                                           description='A timestamp when this instance was created'),
                'finished': fields.DateTime(readonly=True,
                                            description='A timestamp when this instance was solved'),
            })

        list_parser = api.parser()
        list_parser.add_argument('limit', type=int, help='How many objects should be returned', location='query',
                                 default=20)
        list_parser.add_argument('offset', type=int, help='Where to start counting', location='query', default=0)

        @api.route('/embeddings')
        class EmbeddingList(Resource):

            @api.doc('list_embeddings')
            @api.response(code=200, description="Success", model=[linear_layout_schema])
            @api.response(code=500, description="Server Error", model=error_schema)
            @api.expect(list_parser)
            def get(self):
                """
                List all embeddings
                """

                limit = int(request.args.get('limit', 20))
                if (limit < 1) or (limit > 50):
                    abort(400, "limit has to be in range [1,50]")
                offset = int(request.args.get('offset', 0))
                if offset < 0:
                    abort(400, "offset has to be not negative")

                return jsonify(data_store.get_all(limit=limit, offset=offset))

            @api.doc('create_embedding')
            @api.expect(linear_layout_schema)
            @api.param('async', 'Should the processing be handled asynchronous', location="query",
                       default=False, type=bool)
            @api.response(code=200, description="Success", model=linear_layout_schema)
            @api.response(code=500, description="Server Error", model=error_schema)
            @api.response(code=501, description="Not Implemented", model=error_schema)
            @api.response(code=400, description="Bad Request", model=error_schema)
            def post(self):
                """
                Create a new embedding
                """
                entity = request.get_json()

                # looks weird but is the only reliable way to find out if a string value is a true boolean ;-)
                # see https://stackoverflow.com/questions/715417/converting-from-a-string-to-boolean-in-python
                handle_async = request.args.get('async', "", type=str).lower() in yes_list
                try:
                    entity['created'] = datetime.datetime.now(datetime.timezone.utc).isoformat()

                    b64_graph_str = entity.get('graph')
                    try:
                        graph_str = base64.b64decode(b64_graph_str)
                        node_ids, edges = get_nodes_and_edges_from_graph(graph_str)
                        # node_ids ==> List(str)
                        # edges ==> List(Edge)

                    except Exception as e:
                        app.logger.exception(e)
                        raise BadRequest("The graph string has to be a base64 encoded graphml string! "
                                         "The exact error was: " + str(e))

                    len_nodes = len(node_ids) # Number of nodes
                    len_edges = len(edges) # Number of edges

                    if len_edges > 1900 or len_nodes > 600:
                        raise BadRequest(
                            "For fairness reasons this API will only handle graphs with less than 300 vertices and 900 "
                            "edges. Your graph has {} vertices and {} edges which exceed the limit."
                            "".format(len_nodes, len_edges))

                    # Check if self loops are present! We do not support self loops
                    for e in edges:
                        if e.source == e.target:
                            raise BadRequest(
                                "The Implementation only supports graphs where "
                                "every edge has two distinct start and end nodes")

                    # ignore double edges
                    # # validate for no double edges
                    # all_edge_endpoints = [{e.source, e.target} for e in edges]
                    # duplicate_edges = get_duplicates(all_edge_endpoints)
                    # if len(duplicate_edges) > 0:
                    #     abort(400,
                    #           "Multiedges are not allowed. "
                    #           "The following edges were recognized as duplicate {}".format(duplicate_edges))

                    # validate for unique edge ids
                    duplicate_edge_ids = get_duplicates([e.id for e in edges])
                    if len(duplicate_edge_ids) > 0:
                        abort(400,
                              "Edge ids have to be unique"
                              "The following ids were recognized as duplicate {}".format(duplicate_edge_ids))

                    # validate page id uniqueness
                    page_ids = [p['id'] for p in entity.get('pages')]
                    duplicate_page_ids = get_duplicates(page_ids)
                    if len(duplicate_page_ids) > 0:
                        abort(400,
                              "Duplicated page ids are not allowed. "
                              "The following id were recognized as duplicate {}".format(duplicate_page_ids))

                    entity['status'] = 'IN_PROGRESS'
                    entity = data_store.insert_new_element(entity) # entity id is returned here

                    # validate graph not empty
                    if len(page_ids) == 0 or len_edges == 0 or len_nodes == 0:
                        abort(400,
                              "Please submit a graph with at least one node, edge and page")

                    if handle_async:
                        # abort(501, "Async handling is not enabled.")
                        future_result: ProcessFuture = pool.schedule(SolverInterface.solve,
                                                                     (node_ids, edges, entity.get('pages'),
                                                                      entity.get('constraints'),
                                                                      entity['id']))
                        future_result.add_done_callback(processing_finished_callback)

                        future_result.done()
                        # remove old futures
                        remove_old_jobs()
                        jobs.append(QueueItem(entity.get('id'), future_result))

                    else:
                        try:
                            entity = handle_solver_result(SolverInterface.solve(
                                node_ids, edges, entity.get('pages'), entity.get('constraints'), entity['id']))
                        except Exception as e1:
                            error_callback(e1)
                            entity = data_store.get_by_id(entity['id'])

                    return jsonify(entity)
                except HTTPException as e:
                    raise e
                except Exception as e:
                    raise InternalServerError(
                        "The error {} \noccured from this body \n{}".format(str(e),
                                                                            request.get_data(as_text=True))) from e

        @api.route('/embeddings/<string:id>')
        @api.response(404, 'Embedding not found', model=error_schema)
        @api.param('id', 'The task identifier')
        class SingleEmbedding(Resource):

            @api.doc('get_embedding')
            @api.response(code=200, description="Success", model=linear_layout_schema)
            def get(self, id):
                """
                Get an embedding by id
                """
                element = data_store.get_by_id(id)
                if not element:
                    raise NotFound("The given id {} was not present in the data store".format(id))
                else:
                    return jsonify(element)

            @api.doc('delete_embedding')
            @api.response(code=200, description="Success", model=linear_layout_schema)
            def delete(self, id):
                """
                Cancel the computation for the given id.
                """
                element = data_store.get_by_id(id)
                if not element:
                    raise NotFound("The given id {} was not present in the data store".format(id))

                cancel_id = str(id)
                cancel_file_path = 'cancel.txt'

                # Check if file exists. Create cancel.txt if file doesn't exist
                if not os.path.exists(cancel_file_path):
                    open(cancel_file_path, 'w').close()

                cancel_ids = []
                with open(cancel_file_path, 'r') as f:
                    csv_reader = csv.reader(f, delimiter=',')
                    cancel_ids = [row[0] for row in csv_reader]

                if cancel_id not in cancel_ids:
                    with open(cancel_file_path, 'a') as f:
                        csv_writer = csv.writer(f, delimiter=',')
                        csv_writer.writerow([cancel_id])
                    # cancel_ids.append(cancel_id)
                    # with open(cancel_file_path, 'w') as f:
                    #     csv_writer = csv.writer(f, delimiter=',')
                    #     for cid in cancel_ids:
                    #         csv_writer.writerow([cid])

                j_tmp = [j for j in jobs if str(j.id) == str(id)]
                if len(j_tmp) == 1:
                    j_tmp[0].future.cancel()
                    # element['status'] = 'FAILED'
                    element['status'] = 'CANCELLED'
                    element['message'] = 'The job was cancelled by user'
                    data_store.update_entry(id, element)
                    jobs.remove(j_tmp[0])
                return jsonify(element)

        def processing_finished_callback(res: ProcessFuture):
            if not res.done() or res.cancelled():
                pass
            else:
                exception = res.exception()
                if exception is not None:
                    error_callback(exception)
                else:
                    result = res.result()
                    handle_solver_result(result)

        def error_callback(e_param: BaseException):
            try:
                raise e_param
            except IdRelatedException as e:
                id = e.entity_id
                entity = data_store.get_by_id(id)
                if not entity:
                    raise e
                entity['status'] = 'FAILED'
                entity['message'] = e.message

                data_store.update_entry(id, entity)
                if type(e.cause) is HTTPException:
                    raise e.cause
                else:
                    raise e

        def handle_solver_result(result: SolverResult):
            entity = data_store.get_by_id(result.entity_id)
            if not entity:
                raise Exception("The given id {} was not found in the data store".format(result.entity_id))
            entity['status'] = 'FINISHED'
            entity['satisfiable'] = result.satisfiable
            entity['assignments'] = result.page_assignments
            entity['deq_edge_type'] = result.deq_edge_type
            entity['Top'] = result.Top
            entity['Bottom'] = result.Bottom
            entity['List_of_Biarc_Pages'] = result.List_of_Biarc_Pages
            entity['vertex_order'] = result.vertex_order
            entity['rawSolverResult'] = result.solver_output
            entity['finished'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            entity = data_store.update_entry(result.entity_id, entity)
            print("Finished job with id {} in {} s. "
                  "Including waiting time in the queue".format(entity['id'], str(
                parse(entity['finished']) - parse(entity['created']))))
            return entity

        def signal_handler(sig, frame):
            data_store.prepare_shutdown()
            remove_old_jobs()
            print(
                "Shutdown request. "
                "Currently {} Jobs are in queue and will be processed on server start.".format(len(jobs)))
            try:
                pool.stop()
                pool.join(timeout=2)
            finally:
                original_sigint_handler()

        signal.signal(signal.SIGINT, signal_handler)

        unfinished_jobs = data_store.get_unfinished_jobs()
        if len(unfinished_jobs) > 0:
            print("Resuming {} unfinished jobs".format(len(unfinished_jobs)))
        for job in unfinished_jobs:
            b64_graph_str = job.get('graph')
            graph_str = base64.b64decode(b64_graph_str)
            node_ids, edges = get_nodes_and_edges_from_graph(graph_str)

            future: ProcessFuture = pool.schedule(SolverInterface.solve,
                                                  (node_ids, edges, job.get('pages'),
                                                   job.get('constraints'),
                                                   job['id']))
            future.add_done_callback(processing_finished_callback)
            jobs.append(QueueItem(job.get('id'), future))

        return app


app = App().create_app()
