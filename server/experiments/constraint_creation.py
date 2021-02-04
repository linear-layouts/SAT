import networkx as nx

if __name__ == '__main__':
    predecessor_str = """
<constraint>
<type>NODES_PREDECESSOR</type>
<objects>{},{}</objects>
</constraint>"""
    forbid_order_str = """
<constraint>
<type>NODES_FORBID_PARTIAL_ORDER</type>
<objects>{},{},{},{}</objects>
</constraint>"""
    with open("const.xml", mode="w") as f:
        G = nx.Graph()
        G.add_nodes_from([n for n in range(0, 100)])
        f.write("<constraints>")
        for i in range(0, 100, 4):
            G.add_edge(i, i + 1)
            G.add_edge(i, 100)
            G.add_edge(i, 101)
            G.add_edge(i + 1, 100)
            G.add_edge(i + 1, 101)

            G.add_edge(i + 2, 100)
            G.add_edge(i + 2, i)
            G.add_edge(i + 2, i + 1)

            G.add_edge(i + 3, 101)
            G.add_edge(i + 3, i)
            G.add_edge(i + 3, i + 1)

        for i in range(0, 100, 4):
            print(predecessor_str.format(i, i + 1), file=f)

            print(predecessor_str.format(100, i), file=f)
            print(predecessor_str.format(100, i + 1), file=f)

            print(predecessor_str.format(i, 101), file=f)
            print(predecessor_str.format(i + 1, 101), file=f)

            print(forbid_order_str.format(i, i + 2, i + 3, i + 1), file=f)
            print(forbid_order_str.format(i, i + 3, i + 2, i + 1), file=f)
        f.write("</constraints>")

        nx.write_graphml(G, "test.graphml")
