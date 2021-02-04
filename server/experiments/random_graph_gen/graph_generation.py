#!/usr/bin/env python
from random import Random
from typing import List

import matplotlib.pyplot as plt
import networkx as nx

from be.custom_types import Edge


def to_graphml(nodes: List[str], edges: List[Edge]) -> str:
    G = nx.Graph()
    G.add_nodes_from(nodes)
    G.add_edges_from([(e.source, e.target) for e in edges])

    graph_str = "\n".join(nx.generate_graphml(G, prettyprint=False))

    return graph_str


def show_graph(graph_str: str):
    G = nx.parse_graphml(graph_str)
    nx.draw(G, pos=(nx.planar_layout(G)), with_labels=True)
    plt.show()


def random_planar(num_nodes, seed):
    r_stream = Random(seed)
    # first generate some points in the plane, according to our constraints
    nodes = generate_nodes(num_nodes, randstream=r_stream)
    # find a delaunay triangulation, so we have a list of edges that will give planar graphs
    edges, ignore = triangulate(nodes, embedd_gh=False)
    edges = set(edges)
    edges = edges.union((create_edge(0, 2), create_edge(0, 3), create_edge(1, 2), create_edge(1, 3)))
    edges.discard(create_edge(0, 1))
    edges.discard(create_edge(1, 0))
    edges = list(edges)

    node_ids = list([str(i) for i in range(len(nodes))])
    graph_string = to_graphml(node_ids, edges)

    return node_ids, edges, graph_string


def random_planar_gh(num_nodes, seed):
    r_stream = Random(seed)
    # first generate some points in the plane, according to our constraints
    nodes = generate_nodes(num_nodes, randstream=r_stream)
    # find a delaunay triangulation, so we have a list of edges that will give planar graphs
    edges, nodes = triangulate(nodes, embedd_gh=True)
    edges = set(edges)
    edges = edges.union((create_edge(0, 2), create_edge(0, 3), create_edge(1, 2), create_edge(1, 3)))
    edges.discard(create_edge(0, 1))
    edges.discard(create_edge(1, 0))
    edges = list(edges)

    node_ids = list([str(i) for i in range(len(nodes))])
    graph_string = to_graphml(node_ids, edges)

    return node_ids, edges, graph_string


def spine_graph(num_nodes, r_stream):
    assert num_nodes > 5
    nodes = [i for i in range(num_nodes)]

    nodes.remove(2)
    nodes.append(2)

    edges = []

    s_top = nodes[0]
    t_bot = nodes[1]

    # create the first node outside of the loop
    edges.append(create_edge(nodes[2], s_top))
    edges.append(create_edge(nodes[2], t_bot))

    for i in range(3, num_nodes):
        cur_node = nodes[i]
        predecessor = nodes[i - 1]
        edges.append(create_edge(cur_node, s_top))
        edges.append(create_edge(cur_node, t_bot))
        edges.append(create_edge(cur_node, predecessor))
    nodes = [str(n) for n in nodes]
    return nodes, edges, to_graphml(nodes, edges)


def spine_graph_with_embedded_goldner_Harary(num_nodes, r_stream):
    assert num_nodes >= 5
    nodes = [i for i in range(num_nodes)]
    # now two is at the end of the spine
    nodes.remove(2)
    nodes.append(2)

    edges = []

    s_top = nodes[0]
    t_bot = nodes[1]

    # create the first node outside of the loop
    edges.append(create_edge(nodes[2], s_top))
    edges.append(create_edge(nodes[2], t_bot))

    for i in range(3, num_nodes):
        cur_node = nodes[i]
        predecessor = nodes[i - 1]
        edges.append(create_edge(cur_node, s_top))
        edges.append(create_edge(cur_node, t_bot))
        edges.append(create_edge(cur_node, predecessor))

        next_id = max(nodes) + 1
        new_edges, new_nodes = create_embedded_goldner_harary_graph(s_top, cur_node, predecessor, next_id)
        nodes.extend(new_nodes)
        edges.extend(new_edges)

        next_id = max(nodes) + 1
        new_edges, new_nodes = create_embedded_goldner_harary_graph(t_bot, cur_node, predecessor, next_id)
        nodes.extend(new_nodes)
        edges.extend(new_edges)

    nodes = [str(n) for n in nodes]
    return nodes, edges, to_graphml(nodes, edges)


def create_embedded_goldner_harary_graph(top_node, bottom_node, side_node, next_id):
    """
    This method does expect, that the given nodes are already connected
    :param top_node:
    :param bottom_node:
    :param side_node:
    :param next_id:
    :return:
    """
    new_nodes = list(range(next_id, next_id + 8))
    new_edges = []
    # create graph
    new_edges.append(create_edge(top_node, new_nodes[0]))
    new_edges.append(create_edge(top_node, new_nodes[1]))
    new_edges.append(create_edge(top_node, new_nodes[2]))
    new_edges.append(create_edge(top_node, new_nodes[3]))
    new_edges.append(create_edge(top_node, new_nodes[4]))
    new_edges.append(create_edge(top_node, new_nodes[5]))

    new_edges.append(create_edge(bottom_node, new_nodes[0]))
    new_edges.append(create_edge(bottom_node, new_nodes[7]))
    new_edges.append(create_edge(bottom_node, new_nodes[2]))
    new_edges.append(create_edge(bottom_node, new_nodes[6]))
    new_edges.append(create_edge(bottom_node, new_nodes[4]))
    new_edges.append(create_edge(bottom_node, new_nodes[5]))

    new_edges.append(create_edge(side_node, new_nodes[0]))

    new_edges.append(create_edge(new_nodes[0], new_nodes[1]))
    new_edges.append(create_edge(new_nodes[0], new_nodes[2]))
    new_edges.append(create_edge(new_nodes[0], new_nodes[7]))

    new_edges.append(create_edge(new_nodes[2], new_nodes[1]))
    new_edges.append(create_edge(new_nodes[2], new_nodes[3]))
    new_edges.append(create_edge(new_nodes[2], new_nodes[4]))
    new_edges.append(create_edge(new_nodes[2], new_nodes[6]))
    new_edges.append(create_edge(new_nodes[2], new_nodes[7]))

    new_edges.append(create_edge(new_nodes[4], new_nodes[3]))
    new_edges.append(create_edge(new_nodes[4], new_nodes[5]))
    new_edges.append(create_edge(new_nodes[4], new_nodes[6]))
    return new_edges, new_nodes


def create_edge(n1, n2):
    return Edge("{}-{}".format(n2, n1), str(n2), str(n1))


def generate_node(width, height, randstream):
    return randstream.randint(1, width - 2), randstream.randint(1, height - 2)


def distance2(node0, node1):
    dx = node1[0] - node0[0]
    dy = node1[1] - node0[1]
    return dx ** 2 + dy ** 2


def test_node_placement(proposed_node, nodes, exclusion_dist):
    edist2 = exclusion_dist ** 2
    for node in nodes:
        if distance2(node, proposed_node) < edist2:
            return False
    return True


def generate_nodes(n, randstream=Random(42), width=10000, height=10000, exclusion_dist=20):
    # add the inner and outer terminals
    nodes = [(0, 0), (width, height), (width, 0), (0, height)]
    while len(nodes) < n:
        proposed_node = generate_node(width, height, randstream)
        if test_node_placement(proposed_node, nodes, exclusion_dist):
            nodes.append(proposed_node)
    return nodes


def triangle_edges(tri):
    a, b, c = tri
    ab = [min(a, b), max(a, b)]
    bc = [min(b, c), max(b, c)]
    ac = [min(a, c), max(a, c)]
    return [ab, bc, ac]


def triangulate_pyhull(nodes):
    import pyhull.delaunay
    data = pyhull.delaunay.DelaunayTri(nodes)
    return data.vertices


def triangulate(nodes, embedd_gh=False):
    triangles = triangulate_pyhull(nodes)

    next_id = len(nodes)

    edges = []
    for tri in triangles:
        if embedd_gh:
            new_edges, new_nodes = create_embedded_goldner_harary_graph(tri[0], tri[1], tri[2], next_id)
            next_id = max(new_nodes) + 1
            nodes.extend(new_nodes)
            edges.extend(new_edges)
        for edge in triangle_edges(tri):
            edges.append(create_edge(edge[0], edge[1]))

    return list(set(edges)), nodes
