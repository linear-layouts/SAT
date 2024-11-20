from typing import List

from lxml import etree

from be.custom_types import Edge


def get_nodes_and_edges_from_graph(string: str) -> (List[str], List[Edge]):
    """
    Obtains node and enge information from a string containing a graphml definition.
    Ids are taken from the following hierarchy: Userdata at the xml element, id of the xml element, for edges generated
    from <source node>-<target node>. This hierarchy ensures that the API can use a wide variety of valid graphml as
    input.

    :param: the graphml string
    :return: the lists of node ids and edges
    """
    parser = etree.XMLParser(remove_blank_text=True)

    id_tag_key = None
    id_edge_label_key = None
    root = etree.XML(string, parser=parser)
    for child in root:
        if child.get('attr.name') == "UserTags":
            id_tag_key = child.get('id')
        if child.get('attr.name') == "EdgeLabels":
            id_edge_label_key = child.get('id')

    graph_ns = '{http://graphml.graphdrawing.org/xmlns}'
    graph_ns_y = '{http://www.yworks.com/xml/yfiles-common/3.0}'
    graph_root = root.findall('{}graph'.format(graph_ns))
    if len(graph_root) == 0:
        graph_ns = ""
    graph_root = root.findall('{}graph'.format(graph_ns))[0]

    xml_nodes = graph_root.findall('{}node'.format(graph_ns))

    node_id_mapping = {}

    for xml_node in xml_nodes:
        real_id = xml_node.get('id')
        custom_id = xml_node.get('id')

        if id_tag_key:
            for data_element in xml_node.findall('{}data'.format(graph_ns)):
                if data_element.get('key') == id_tag_key:
                    custom_id = data_element[0].text
                    break
        node_id_mapping[real_id] = custom_id

    xml_edges = graph_root.findall('{}edge'.format(graph_ns))

    edges = []

    for xml_edge in xml_edges:
        custom_id = xml_edge.get('id')
        source = xml_edge.get('source')
        target = xml_edge.get('target')
        weight = 0

        if id_tag_key:
            for data_element in xml_edge.findall('{}data'.format(graph_ns)):
                if data_element.get('key') == id_tag_key:
                    custom_id = data_element[0].text
                elif data_element.get('key') == id_edge_label_key:
                    for child in data_element.iter('{}Label.Text'.format(graph_ns_y)):
                        weight = int(child.text)   
        if not custom_id:
            custom_id = "{}-{}".format(source, target)

        edges.append(Edge(custom_id, node_id_mapping[source], node_id_mapping[target], weight))

    return list(node_id_mapping.values()), edges
