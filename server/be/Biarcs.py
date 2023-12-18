from typing import List
import time
import numpy as np
from flask_restplus import abort
from numpy import ndarray
from be.custom_types import Edge, PageAssignment, EdgeType, TypeEnum
from numba import jit

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
    #-------------------------------Top and Bottom Properties-------------------------------
    for E in range(edges.shape[0]):
        e = edges[E][0]
        ev1 = edges[E][1]
        ev2 = edges[E][2]
        for v in range(precedes.shape[0]):
            #Either Top is true or Bottom is true and they are never true simultaniously (no measures for Both false always)
            clauses.append([-Top[e, v ,p], -Bottom[e, v, p]])
            clauses.append([-Bottom[e, v, p], edge_to_page[p, e]])
            clauses.append([-Top[e, v, p], edge_to_page[p, e]])
            #clauses.append([-edge_to_page[p, e], -Top[e, v ,p], -Bottom[e, v, p]])
            if (v != ev1 and v != ev2): 
                #Both Top and Bottom are false if edge e is neither above nor below vertex x.
                clauses.append([ -edge_to_page[p, e], -precedes[ev1,v], -precedes[ev2, v], -Top[e, v, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[ev1,v], -precedes[ev2, v], -Bottom[e, v, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[ev1,v], -precedes[ev2, v], Top[e, ev1, p], Bottom[e, ev1, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[ev1,v], -precedes[ev2, v], Top[e, ev2, p], Bottom[e, ev2, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[v,ev1], -precedes[v, ev2], -Top[e, v, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[v,ev1], -precedes[v, ev2], -Bottom[e, v, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[v,ev1], -precedes[v, ev2],  Top[e, ev1, p], Bottom[e, ev1, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[v,ev1], -precedes[v, ev2],  Top[e, ev2, p], Bottom[e, ev2, p]])

                #XOR switch for making either Top or Bottom to be true when an edge :
                #1] Starts from a verex.
                #2] Ends to a vertex.
                #3] Has a vertex between the endpoints of an edge.
                #Works only because we already have that Top and Bottom unable to be both true at the same time. 
                

                #If e1v1 is leftmost endpoint.

                clauses.append([ -edge_to_page[p, e], -precedes[ev1, v], -precedes[v, ev2], Top[e, ev1, p], Bottom[e, ev1, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[ev1, v], -precedes[v, ev2], Top[e, ev2, p], Bottom[e, ev2, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[ev1, v], -precedes[v, ev2], Top[e, v, p], Bottom[e, v, p]])

                #If e1v2 is leftmost endpoint.

                clauses.append([ -edge_to_page[p, e], -precedes[ev2, v], -precedes[v, ev1], Top[e, ev1, p], Bottom[e, ev1, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[ev2, v], -precedes[v, ev1], Top[e, ev2, p], Bottom[e, ev2, p]])
                clauses.append([ -edge_to_page[p, e], -precedes[ev2, v], -precedes[v, ev1], Top[e, v, p], Bottom[e, v, p]])


    #Prevent edges from having more than two arcs
    for e in range(edges.shape[0]):
        e1 = edges[e][0]
        e1v1 = edges[e][1]
        e1v2 = edges[e][2]
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
    #----                  

    #-------------------------------Forbidden Patterns For Edges Without Common Endpoints-------------------------------
    for e in range(edges.shape[0]):
        e1 = edges[e][0]
        e1v1 = edges[e][1]
        e1v2 = edges[e][2]
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

    for e in range(edges.shape[0]):
        e1 = edges[e][0]
        e1v1 = edges[e][1]
        e1v2 = edges[e][2]
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

    return clauses

