import subprocess
from concurrent.futures import CancelledError

from werkzeug.exceptions import BadRequest

from be.custom_types import SolverResult
from be.exceptions import IdRelatedException
from be.model import SatModel


class SolverInterface(object):
    """
    This class provides an simplified interface to the :class:`.SatModel`:
    """

    @classmethod
    def solve(cls, nodes, edges, pages, constraints, entity_id) -> SolverResult:
        """
        Initializes the class :class `.SatModel`: with the given parameters and triggers the clause generation. Afterwards
        the created clauses are send to the SAT solver and the result is parsed back and returned.

        :param nodes: the nodes/vertexes of the problem instance
        :param edges: the edges of the problem instance
        :param pages: the pages of the problem instance
        :param constraints: the constraints of the problem instance
        :param entity_id: the id of the problem instance. This is used to wrap any exception in an
                            :class:`.IdRelatedException` in order to pass the id to the handling method.
        :return: the solved result of the problem instance
        """
        try:
            model = SatModel(pages, edges, nodes, constraints)

            print("Adding constraints")

            model.add_relative_order_clauses()

            model.add_page_assignment_clauses()

            model.add_page_constraints()

            model.add_additional_constraints()

            print("Start solving")

            dimacstr = model.to_dimacs_str()
            output = cls._call_lingeling_with_string(dimacstr)

            print("Finished solving")

            sat_result = model.parse_lingeling_result(str(output, encoding='UTF-8'))

            page_assignments = None
            vertex_order = None
            deq_edge_type = None
            if sat_result['satisfiable']:
                vertex_order = model.get_vertex_order_result()
                page_assignments = model.get_page_assignment_result()
                deq_edge_type = model.get_edge_type_result()

            return SolverResult(satisfiable=sat_result['satisfiable'],
                                page_assignments=page_assignments,
                                vertex_order=vertex_order,
                                deq_edge_type=deq_edge_type,
                                solver_output=sat_result['full'],
                                entity_id=entity_id)
        except KeyError as e:
            raise BadRequest("The id {} was not found in the graph".format(str(e))) from e
        except CancelledError:
            pass
        except Exception as e:
            raise IdRelatedException(entity_id, "{} : {} ".format(type(e), str(e)), e) from e

    @classmethod
    def _call_lingeling_with_string(cls, dimacstr):
        try:
            output = subprocess.check_output(["lingeling"], input=bytes(dimacstr, 'UTF-8'))
        except subprocess.CalledProcessError as e:
            # lingeling does return 10 as returncode if everything is alright
            if e.returncode == 10 or e.returncode == 20:
                output = e.output
            elif e.returncode == 1:
                raise Exception("The dimacs file was incorrect and was rejected from lingeling. "
                                "The file was {}".format(dimacstr)) from e
            else:
                raise Exception(
                    "lingeling call failed with stderr >{}< and stdout >{}<".format(e.stderr, e.stdout)) from e
        return output
