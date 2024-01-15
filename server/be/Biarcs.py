from typing import List
import time
import numpy as np
from flask_restplus import abort
from numpy import ndarray
from be.custom_types import Edge, PageAssignment, EdgeType, TypeEnum
from numba import jit
from concurrent.futures import ProcessPoolExecutor

def static_encode_not_all_in_page(edge_to_page: ndarray, edges: ndarray, p: int) -> List[List[int]]:
    """
    Encodes the constraint that not all given edges go to the same given page.
    :param edge_to_page: the index of the first edge
    :param edges: the given edges
    :param p: the page
    :return: the generated clauses
    """
    
    clause = []
    for e in edges:
        clause.append(-edge_to_page[p, e])
    return clause

def static_encode_biarc_page(precedes: ndarray, edge_to_page: ndarray, Top: ndarray, Bottom: ndarray, edges: ndarray, p: int) -> List[List[int]]:
    """
    Encodes a biarc page

    :param precedes: precedes[i, j] <=> vertex i precedes vertex j
    :param edge_to_page: edge_to_page[p, e] <=> edge e is assigned to page p
    :param edges: all edges
    :param p: the index of the current page
    :param Top[e, v, p] <=> Edge e is above vertex v in page p.
    :param Bottom[e, v ,p] <=> Edge e is below vertex v in page p.
            """
    clauses = []

    #Processes_Number represends how many Edges will be calculated simultaneously (number of threads), can either match cpu cores or set to None for maximum performance
    #4 is the recommended value
    #Info on speedup:
    #Using 1 thread is serial execution and is recommended for servers
    #Using 4 threads results in an average speedup of 3
    #Using 8 threads results in an average speedup of 4.5
    #Using 12 threads results in an average speedup of just below 5
    Processes_Number = 1
    
    Number_Of_Completed_Tasks = 0
    workload = [(e, edges, precedes, edge_to_page, Top, Bottom, p) for e in range(edges.shape[0])]
    Total_Number_Of_Tasks = len(workload)
    Number_Of_Completed_Tasks = 0
    with ProcessPoolExecutor(Processes_Number) as executor:
        futures = [executor.submit(static_encode_biarc_page_worker, args) for args in workload]
        for future in futures:
            future.result()
            Number_Of_Completed_Tasks += 1
            percentage = (((Number_Of_Completed_Tasks) / (Total_Number_Of_Tasks)) * 100)
            print(f"\rProgress for page {p} : {percentage:.2f}%", end="", flush=True)
        print()
    Per_Parrallel_Loop_results = [future.result() for future in futures]
    for result in Per_Parrallel_Loop_results:
        clauses.extend(result) #here extend works as append

    return clauses


    #-------------------------------Top and Bottom Properties-------------------------------
def static_encode_biarc_page_worker(args):
        e, edges, precedes, edge_to_page, Top, Bottom, p = args
        clauses = []
        e1 = edges[e][0]
        e1v1 = edges[e][1]
        e1v2 = edges[e][2]
        for v in range(precedes.shape[0]):
            #Either Top is true or Bottom is true and they are never true simultaniously (no measures for Both false always)
            clauses.append([-Top[e1, v ,p], -Bottom[e1, v, p]])
            clauses.append([-Bottom[e1, v, p], edge_to_page[p, e1]])
            clauses.append([-Top[e1, v, p], edge_to_page[p, e1]])
            if (v != e1v1 and v != e1v2): 
                #Both Top and Bottom are false if edge e is neither above nor below vertex x.
                clauses.append([ -edge_to_page[p, e1], -precedes[e1v1,v], -precedes[e1v2, v], -Top[e1, v, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[e1v1,v], -precedes[e1v2, v], -Bottom[e1, v, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[e1v1,v], -precedes[e1v2, v], Top[e1, e1v1, p], Bottom[e1, e1v1, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[e1v1,v], -precedes[e1v2, v], Top[e1, e1v2, p], Bottom[e1, e1v2, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[v,e1v1], -precedes[v, e1v2], -Top[e1, v, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[v,e1v1], -precedes[v, e1v2], -Bottom[e1, v, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[v,e1v1], -precedes[v, e1v2],  Top[e1, e1v1, p], Bottom[e1, e1v1, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[v,e1v1], -precedes[v, e1v2],  Top[e1, e1v2, p], Bottom[e1, e1v2, p]])

                #XOR switch for making either Top or Bottom to be true when an edge :
                #1] Starts from a verex.
                #2] Ends to a vertex.
                #3] Has a vertex between the endpoints of an edge.
                #Works only because we already have that Top and Bottom unable to be both true at the same time. 
                

                #If e1v1 is leftmost endpoint.

                clauses.append([ -edge_to_page[p, e1], -precedes[e1v1, v], -precedes[v, e1v2], Top[e1, e1v1, p], Bottom[e1, e1v1, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[e1v1, v], -precedes[v, e1v2], Top[e1, e1v2, p], Bottom[e1, e1v2, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[e1v1, v], -precedes[v, e1v2], Top[e1, v, p], Bottom[e1, v, p]])

                #If e1v2 is leftmost endpoint.

                clauses.append([ -edge_to_page[p, e1], -precedes[e1v2, v], -precedes[v, e1v1], Top[e1, e1v1, p], Bottom[e1, e1v1, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[e1v2, v], -precedes[v, e1v1], Top[e1, e1v2, p], Bottom[e1, e1v2, p]])
                clauses.append([ -edge_to_page[p, e1], -precedes[e1v2, v], -precedes[v, e1v1], Top[e1, v, p], Bottom[e1, v, p]])

    #Prevent edges from having more than two arcs
                
        #Pos1, Pos2, Pos3, Pos4 and Pos5 are variables
        #representing the positions of verteces such that
        #Pos1 precedes Pos2, Pos2 precedes Pos3 and so on.
        for Pos1 in range(precedes.shape[0]):
            for Pos2 in range(precedes.shape[0]):
                if Pos1 == Pos2:
                    continue
                for Pos3 in range(precedes.shape[0]):
                    if (Pos1 == Pos3 or Pos2 == Pos3):
                        continue
                    if ((Pos1 == e1v1 and Pos3 == e1v2) or (Pos1 == e1v2 and Pos3 == e1v1)):
                        forbidden_patterns1 = np.array([
                            -edge_to_page[p, e1], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -Top[e1, Pos1, p], -Bottom[e1 , Pos2, p], -Top[e1, Pos3, p]
                        ])
                        forbidden_patterns2 = np.array([
                            -edge_to_page[p, e1], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -Bottom[e1, Pos1, p], -Top[e1 , Pos2, p], -Bottom[e1, Pos3, p]
                        ])
                        clauses.append((forbidden_patterns1).tolist())
                        clauses.append((forbidden_patterns2).tolist())
                    for Pos4 in range(precedes.shape[0]):
                        if (Pos1 == Pos4 or Pos2 == Pos4 or Pos3 == Pos4):
                            continue
                        if ((Pos1 == e1v1 and Pos4 == e1v2) or (Pos1 == e1v2 and Pos4 == e1v1)):
                                    forbidden_patterns1 = np.array([
                                        -edge_to_page[p, e1], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4], -Top[e1, Pos1, p], -Bottom[e1 , Pos2, p], -Top[e1, Pos3, p], -Bottom[e1 , Pos4, p] #test
                                    ])
                                    forbidden_patterns2 = np.array([
                                        -edge_to_page[p, e1], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4], -Bottom[e1, Pos1, p], -Top[e1 , Pos2, p], -Bottom[e1, Pos3, p], -Top[e1 , Pos4, p] # test
                                    ])
                                    clauses.append((forbidden_patterns1).tolist())
                                    clauses.append((forbidden_patterns2).tolist())
                        for Pos5 in range(precedes.shape[0]):
                                if (Pos1 == Pos5 or Pos2 == Pos5 or Pos3 == Pos5 or Pos4 == Pos5):
                                    continue
                                if ((Pos1 == e1v1 and Pos5 == e1v2) or (Pos1 == e1v2 and Pos5 == e1v1)):
                                    forbidden_patterns1 = np.array([
                                        -edge_to_page[p, e1], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4] , -precedes[Pos4, Pos5], -Top[e1, Pos2, p], -Bottom[e1 , Pos3, p], -Top[e1, Pos4, p]
                                    ])
                                    forbidden_patterns2 = np.array([
                                        -edge_to_page[p, e1], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4] , -precedes[Pos4, Pos5], -Bottom[e1, Pos2, p], -Top[e1 , Pos3, p], -Bottom[e1, Pos4, p]
                                    ])
                                    clauses.append((forbidden_patterns1).tolist())
                                    clauses.append((forbidden_patterns2).tolist())
    #-------------------------------Forbidden Patterns For Edges Without Common Endpoints-------------------------------
        for f in range(edges.shape[0]):
            e2 = edges[f][0]
            if e1 == e2:
                continue
            e2v1 = edges[f][1]
            e2v2 = edges[f][2]
            #Pos1, Pos2, Pos3, Pos4 and Pos5 are variables
            #representing the positions of verteces such that
            #Pos1 precedes Pos2, Pos2 precedes Pos3 and so on.
            for Pos1 in range(precedes.shape[0]):
                for Pos2 in range(precedes.shape[0]):
                    if Pos1 == Pos2:
                        continue
                    for Pos3 in range(precedes.shape[0]):
                        if (Pos1 == Pos3 or Pos2 == Pos3):
                            continue
                        for Pos4 in range(precedes.shape[0]):
                            if (Pos1 == Pos4 or Pos2 == Pos4 or Pos3 == Pos4):
                                continue
                            
                            #Both up cases.
                            
                            if (((Pos1 == e1v1 and Pos3 == e1v2) and (Pos2 == e2v1 and Pos4 == e2v2)) or 
                            ((Pos1 == e1v1 and Pos3 == e1v2) and (Pos2 == e2v2 and Pos4 == e2v1)) or 
                            ((Pos1 == e1v2 and Pos3 == e1v1) and (Pos2 == e2v2 and Pos4 == e2v1)) or 
                            ((Pos1 == e1v2 and Pos3 == e1v1) and (Pos2 == e2v1 and Pos4 == e2v2))):
                                forbidden_patterns1 = np.array([
                                    -edge_to_page[p, e1], -edge_to_page[p, e2], -Top[e1, Pos2, p], -Top[e2, Pos3, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4]
                                ])
                                forbidden_patterns2 = np.array([
                                    -edge_to_page[p, e1], -edge_to_page[p, e2], -Bottom[e1, Pos2, p], -Bottom[e2, Pos3, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4]
                                ])
                                clauses.append((forbidden_patterns1).tolist())
                                clauses.append((forbidden_patterns2).tolist())
                            
                            #Cut biarc cases.
                            
                            if (((Pos1 == e1v1 and Pos4 == e1v2) and (Pos2 == e2v1 and Pos3 == e2v2)) or 
                            ((Pos1 == e1v1 and Pos4 == e1v2) and (Pos2 == e2v2 and Pos3 == e2v1)) or
                            ((Pos1 == e1v2 and Pos4 == e1v1) and (Pos2 == e2v1 and Pos3 == e2v2)) or
                            ((Pos1 == e1v2 and Pos4 == e1v1) and (Pos2 == e2v2 and Pos3 == e2v1))):
                                forbidden_patterns1 = np.array([
                                    -edge_to_page[p, e1], -edge_to_page[p, e2], -Top[e1, Pos2, p], -Bottom[e1, Pos3, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4]
                                ])
                                forbidden_patterns2 = np.array([
                                    -edge_to_page[p, e1], -edge_to_page[p, e2], -Bottom[e1, Pos2, p], -Top[e1, Pos3, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4]
                                ])
                                clauses.append((forbidden_patterns1).tolist())
                                clauses.append((forbidden_patterns2).tolist())
                            
                            #Exrta cases.
                            
                            for Pos5 in range(precedes.shape[0]):
                                if (Pos1 == Pos5 or Pos2 == Pos5 or Pos3 == Pos5 or Pos4 == Pos5):
                                    continue
                                if (((Pos1 == e1v1 and Pos4 == e1v2) or (Pos1 == e1v2 and Pos4 == e1v1)) and ((Pos2 == e2v1 and Pos5 == e2v2) or (Pos2 == e2v2 and Pos5 == e2v1)) and Pos3 != e2v1 and Pos3 != e2v2):
                                    forbidden_patterns1 = np.array([
                                        -edge_to_page[p, e1], -edge_to_page[p, e2], -Top[e1, Pos2, p], -Top[e2, Pos3, p], -Bottom[e1, Pos3, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4], -precedes[Pos4, Pos5]
                                    ])
                                    forbidden_patterns2 = np.array([
                                        -edge_to_page[p, e1], -edge_to_page[p, e2], -Bottom[e1, Pos2, p], -Bottom[e2, Pos3, p], -Top[e1, Pos3, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4], -precedes[Pos4, Pos5]
                                    ])
                                    clauses.append((forbidden_patterns1).tolist())
                                    clauses.append((forbidden_patterns2).tolist())
            #Pos1, Pos2, Pos3, Pos4 and Pos5 are variables
            #representing the positions of verteces such that
            #Pos1 precedes Pos2, Pos2 precedes Pos3 and so on.
            for Pos1 in range(precedes.shape[0]):
                for Pos2 in range(precedes.shape[0]):
                    if Pos1 == Pos2:
                        continue
                    for Pos3 in range(precedes.shape[0]):
                        if (Pos1 == Pos3 or Pos2 == Pos3):
                            continue
                        for Pos4 in range(precedes.shape[0]):
                            if (Pos1 == Pos4 or Pos2 == Pos4 or Pos3 == Pos4):
                                continue
                            if (((Pos1 == e1v1 and Pos4 == e1v2) and (Pos1 == e2v1 and Pos3 == e2v2)) or 
                            ((Pos1 == e1v1 and Pos4 == e1v2) and (Pos1 == e2v2 and Pos3 == e2v1)) or 
                            ((Pos1 == e1v2 and Pos4 == e1v1) and (Pos1 == e2v2 and Pos3 == e2v1)) or 
                            ((Pos1 == e1v2 and Pos4 == e1v1) and (Pos1 == e2v1 and Pos3 == e2v2))):
                                forbidden_patterns1 = np.array([
                                    -edge_to_page[p, e1], -edge_to_page[p, e2], -Bottom[e1, Pos2, p], -Top[e1, Pos3, p], -Top[e2, Pos2, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4]
                                ])
                                forbidden_patterns2 = np.array([
                                    -edge_to_page[p, e1], -edge_to_page[p, e2], -Top[e1, Pos2, p], -Bottom[e1, Pos3, p], -Bottom[e2, Pos2, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4]
                                ])
                                clauses.append((forbidden_patterns1).tolist())
                                clauses.append((forbidden_patterns2).tolist())
                            if (((Pos4 == e1v1 and Pos1 == e1v2) and (Pos4 == e2v1 and Pos2 == e2v2)) or 
                            ((Pos4 == e1v1 and Pos1 == e1v2) and (Pos4 == e2v2 and Pos2 == e2v1)) or 
                            ((Pos4 == e1v2 and Pos1 == e1v1) and (Pos4 == e2v2 and Pos2 == e2v1)) or 
                            ((Pos4 == e1v2 and Pos1 == e1v1) and (Pos4 == e2v1 and Pos2 == e2v2))):
                                forbidden_patterns1 = np.array([
                                    -edge_to_page[p, e1], -edge_to_page[p, e2], -Top[e1, Pos3, p], -Bottom[e1, Pos2, p], -Bottom[e2, Pos3, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4]
                                ])
                                forbidden_patterns2 = np.array([
                                    -edge_to_page[p, e1], -edge_to_page[p, e2], -Bottom[e1, Pos3, p], -Top[e1, Pos2, p], -Top[e2, Pos3, p], -precedes[Pos1, Pos2], -precedes[Pos2, Pos3], -precedes[Pos3, Pos4]
                                ])
                                clauses.append((forbidden_patterns1).tolist())
                                clauses.append((forbidden_patterns2).tolist())
        #-------------------------------Forbidden Patterns For Edges With Common Endpoints-------------------------------
        #-------------------------------Locate K5 subgraphs and forbid all their edges to be in the same page-------------------------------
        if (precedes.shape[0] < 300 and precedes.shape[0] > 4):
            n = precedes.shape[0]
            m = edges.shape[0]
            matrix = [[0 for u in range(n)] for v in range(n)]
            map = [[0 for u in range(n)] for v in range(n)]
            # Create the adjacent matrix
            for e in range(m):
                s = edges[e][1]
                t = edges[e][2]
                matrix[s][t] = 1
                matrix[t][s] = 1
                map[s][t] = e
                map[t][s] = e
                

            for u in range(n):
                for v in range(u,n):
                    for w in range(v,n):
                        for z in range(w,n):
                            for k in range(z,n):
                                if (matrix[u][v] == 1 and matrix[u][w] == 1 and matrix[u][z] == 1 and matrix[u][k] == 1 and #edges from u to the other 4 verteces
                                    matrix[v][w] == 1 and matrix[v][z] == 1 and matrix[v][k] == 1 and #edges from v to the other 3 verteces
                                    matrix[w][z] == 1 and matrix[w][k] == 1 and #edges from w to the other 2 verteces
                                    matrix[z][k] == 1): #edge from z to k
                                        #print("Found K5 on vetreces" , u , " " , v , " " , w , " " , z , " " , k)
                                        clauses.append(static_encode_not_all_in_page(edge_to_page,
                                                                                 np.array([map[u][v], map[u][w], map[u][z], map[u][k],
                                                                                  map[v][w], map[v][z], map[v][k],
                                                                                   map[w][z], map [w][k],
                                                                                    map[z][k]]), p))
                                        

        
        return clauses
