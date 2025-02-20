'use strict'

require.config({
	paths: {
		yfiles: 'libs/yFiles/lib/umd/',
		utils: 'libs/yFiles/demos/utils/',
		resources: 'libs/yFiles/demos/resources/'
	}
})

require([

	'yfiles/view-editor',
	'utils/ContextMenu',
	'utils/FileSaveSupport',
	'yfiles/complete',
	'js/ClientSideImageExport.js',
	'js/ClientSidePdfExport.js',
	'js/next_query.js',
	'resources/license',

	], (/** @type {yfiles_namespace} */ /** typeof yfiles */ yfiles,
			ContextMenu,
			FileSaveSupport,
			PositionHandler,
			ShowClientSideImageExport,
			ShowClientSidePdfExport
	) => {

	/*
	----------------------------------------------------------------------------------------------
		Custom ENUMs
	----------------------------------------------------------------------------------------------
	*/

	const LayoutOption = {
		LINEAR : "Linear",
		CIRCULAR : "Circular",
		CONSTRAINED : "Constrained",
		MATRIX: "Matrix"
	}

	/*
	----------------------------------------------------------------------------------------------
		Global Variables
	----------------------------------------------------------------------------------------------
	*/
	var numberOfPages = parseInt(window.localStorage.getItem("numberOfPages"));

    let pagesArray = [];
    let DeqTypesMap = new Map([["TAIL", []], ["HEAD", []], ["QUEUE_H_T", []], ["QUEUE_T_H", []]]);
    var nextNodex = 0;
    const node_distance = 200;

    function dynamicPagesArray() {
        let i = 0;
        for (i=0; i < numberOfPages; i++) {
            pagesArray.push([])
        }
    }
    dynamicPagesArray();

	let graphComponent = [];
	let graphMLIOHandler = null;
	let graph = null;
	let gridInfo = null;
	let grid = null;
	let clientSideImageExport = null;
	let clientSidePdfExport = null;
	let myGraph;
	let colorsOfPages = [];

	let treatEdgesAsDirected = false;
	let originalNodeHeight = 30;
	let originalNodeWidth = 30;
	let standardServer = "http://alice.cs.uni-tuebingen.de:5555/embeddings"
	let numberOfVisibleNodesOnConstrainedLayout = 0
	let currentLayout = LayoutOption.LINEAR
	let previousLayout = LayoutOption.LINEAR
	let selectedConstraints = {}
//  var pagesArray = [[],[],[],[]]
/*    let pagesArray = [
        [], //1
        [], //2
        [], //3
        [], //4
        [], //5
        [], //6
        [], //7
        [], //8
        [], //9
        [], //10
        [],
        [],
    ];*/
	let respondedObject = null;
	let link;
	let constraintsArray =[]
	let chosenPages = 0;

    //var colors = ["#FF0000", "#0000FF", "#00FF00", "#000000"];
    var initialColors = ["#FF0000","#0000FF", "#00FF00", "#7E7E7E", "#8A2BE2",  "#FFFF00", "#15E2CB", "#FF007F", "#FF8300", "#000000"];


    var colors = new Array(numberOfPages)
    for ( var i = 0; i<colors.length; i++)
    {
        if (i < initialColors.length)
        {
            colors[i] = initialColors[i]
        }
        else {
            colors[i] = "#000000"
        }
    }

	let predecessors = new Map();

  /*  function addDefaultColor() {
   if (colors.length < numberOfPages) {
      let i;
      for(i=colors.length;i<numberOfPages;i++) {
           colors.push("#000000");
       }
    }
}
addDefaultColor();*/

/*
    function getColor(i) {
        if (i > 10) {
            return"#000000"
        }
        else {
            return colors[i]
        }
    }*/
	/*
	----------------------------------------------------------------------------------------------
		Utility Functions
	----------------------------------------------------------------------------------------------
	*/

    // Load constraints Global Variable from JSON
	function loadConstraintsFromJSON(constraints){
		constraintsArray = [];
		constraints.forEach(function(c) {
			switch(c.type) {
				case "NODES_PREDECESSOR":
					var objItems = [];
					// for all arguments search through all nodes to connect them to the constraint
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					// for all modifiers do the same
					c.modifier.forEach(function(m) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === m) {
								objItems.push(n);
							}
						});
					});
					var con = new Predecessor(objItems);
					constraintsArray.push(con);
					break;
				case "NODES_CONSECUTIVE":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new Consecutive(objItems);
					constraintsArray.push(con);
					break;
				case "NODES_NON_CONSECUTIVE":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new NonConsecutive(objItems);
					constraintsArray.push(con);
					break;
				case "NODES_NON_EXTREMES":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new NonExtremes(objItems);
					constraintsArray.push(con);
					break;
				case "NODES_SET_FIRST":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new SetAsFirst(objItems);
					constraintsArray.push(con);
					break;
				case "NODES_SET_NOT_FIRST":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new SetAsNotFirst(objItems);
					constraintsArray.push(con);
					break;
				case "NODES_SET_LAST":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new SetAsLast(objItems);
					constraintsArray.push(con);
					break;
				case "NODES_SET_NOT_LAST":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new SetAsNotLast(objItems);
					constraintsArray.push(con);
					break;
				case "EDGES_SAME_PAGES_INCIDENT_NODE":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new SamePageForIncidentEdgesOf(objItems);
					constraintsArray.push(con);
					break;
				case "EDGES_DIFFERENT_PAGES_INCIDENT_NODE":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n)
							}
						});
					});
					var con = new DifferentPagesForIncidentEdgesOf(objItems);
					constraintsArray.push(con);
					break;
				case "EDGES_SAME_PAGES":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.edges.toArray().forEach(function(e) {
							if (e.tag.toString() === a) {
								objItems.push(e);
							}
						});
					});
					var con = new SamePage(objItems);
					constraintsArray.push(con);
					break;
				case "EDGES_DIFFERENT_PAGES":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.edges.toArray().forEach(function(e) {
							if (e.tag.toString() === a) {
								objItems.push(e);
							}
						});
					});
					con = new DifferentPages(objItems);
					constraintsArray.push(con);
					break;
				case "NOT_ALL_IN_SAME_PAGE":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.edges.toArray().forEach(function(e) {
							if (e.tag.toString() === a) {
								objItems.push(e);
							}
						});
					});
					var con = new NotAllInSamePage(objItems);
					constraintsArray.push(con);
					break;
				case "EDGES_ON_PAGES_INCIDENT_NODE":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new IncidentEdgesOfVertexTo([objItems, c.modifier]);
					constraintsArray.push(con);
					break;
				case "EDGES_ON_PAGES":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.edges.toArray().forEach(function(e) {
							if (e.tag.toString() === a) {
								objItems.push(e);
							}
						});
					});
					var con = new AssignedTo([objItems, c.modifier]);
					constraintsArray.push(con);
					break;
				case "NODES_REQUIRE_PARTIAL_ORDER":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new RequirePartialOrder(objItems);
					constraintsArray.push(con);
					break;
				case "NODES_FORBID_PARTIAL_ORDER":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new ForbidPartialOrder(objItems);
					constraintsArray.push(con);
					break;
				case "EDGES_FROM_NODES_ON_PAGES":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new RestrictEdgesFrom([objItems, c.modifier]);
					constraintsArray.push(con);
					break;
				case "EDGES_TO_SUB_ARC_ON_PAGES":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.nodes.toArray().forEach(function(n) {
							if (n.tag.toString() === a) {
								objItems.push(n);
							}
						});
					});
					var con = new RestrictEdgesToArc([objItems, c.modifier]);
					constraintsArray.push(con);
					break;
				case "TREAT_GRAPH_DIRECTED":
					treatEdgesAsDirected = true
					var con = new TreatGraphDirected(graphComponent.graph.edges.toArray());
					constraintsArray.push(con);
					break;
				case "HAMILTONIAN_CYCLE":
					var con = new HamiltonianCycle(graphComponent.graph.edges.toArray());
					constraintsArray.push(con);
					break;
				case "HAMILTONIAN_PATH":
					var con = new HamiltonianPath(graphComponent.graph.edges.toArray());
					constraintsArray.push(con);
					break;
				case "EDGES_SET_STACK_ABOVE":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.edges.toArray().forEach(function(e) {
							if (e.tag.toString() === a) {
								objItems.push(e);
							}
						});
					});
					var con = new SetAsStackAbove([objItems, c.modifier]);
					constraintsArray.push(con);
					break;
				case "EDGES_SET_STACK_BELOW":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.edges.toArray().forEach(function(e) {
							if (e.tag.toString() === a) {
								objItems.push(e);
							}
						});
					});
					var con = new SetAsStackBelow([objItems, c.modifier]);
					constraintsArray.push(con);
					break;
				case "EDGES_SET_BIARC":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.edges.toArray().forEach(function(e) {
							if (e.tag.toString() === a) {
								objItems.push(e);
							}
						});
					});
					var con = new SetAsBiarc([objItems, c.modifier]);
					constraintsArray.push(con);
					break;
				case "EDGES_SET_STACK":
					var objItems = [];
					c.arguments.forEach(function(a) {
						graphComponent.graph.edges.toArray().forEach(function(e) {
							if (e.tag.toString() === a) {
								objItems.push(e);
							}
						});
					});
					var con = new SetAsStack([objItems, c.modifier]);
					constraintsArray.push(con);
					break;
			}
		})

		// Load constraints with new nodes and edges
		$("#constraintTags").tagit("removeAll");
		for(let c of constraintsArray) {
			$("#constraintTags").tagit("createTag", c.getPrintable());
		}
		updateSelectedConstraints();
		for(let index of Object.keys(selectedConstraints)){
			highlightConstraintTagUsingIndex(index);
		}
	}

	function registerEdgesInPagesArray(assignments) {
		// registering which edges go on which pages
		assignments.forEach(function(a) {
			let arrayLocation = a.page.slice(1)
			arrayLocation = arrayLocation-1;
			let edges = graphComponent.graph.edges.toArray()
			edges.forEach(function(e) {
				if (a.edge === e.tag.toString()) {
					pagesArray[arrayLocation].push(e)
				}
			})
		})
	}

	function registerEdgesDequeType(types) {
		// registering which edges are of which deque type
		if (types.length !== 0) {
			types.forEach(function(t) {
				let type = DeqTypesMap.get(t.edge_type);
				let edges = graphComponent.graph.edges.toArray();
				edges.forEach(function(e) {
					if (t.edge === e.tag.toString()) {
						type.push(e)
					}
				})
			})
		}
	}

	function registerListOfBiarcPages(BiarcList) {
		
	}

	const CorrectedMyResults = { 'Position': [] };
	const Biarc_Edge_After_Rearangement = [];

	function registerBiarcsEdgePositions(ABOVE, BELOW) {
		respondedObject.vertex_order.forEach(function(node_tag) {
			let My_Node = getNodeByTag(node_tag);
			//console.error(My_Node.toString())
		})
		//Check if ABOVE and BELOW are arrays, if not then there is an issue from transfering Top and Bottom from model.py
		if (!Array.isArray(ABOVE)) {
			console.error('ABOVE is not an array.');
			return;
		}
		if (!Array.isArray(BELOW)) {
			console.error('BELLOW is not an array.');
			return;
		}
	
		//Check if ABOVE and BELOW have any values
		if (ABOVE.length === 0) {
			console.error('ABOVE has no elements.');
			return;
		}
		if (BELOW.length === 0) {
			console.error('BELOW has no elements.');
			return;
		}
		const ABOVE_size = [ABOVE.length, ABOVE[0].length, ABOVE[0][0].length];
		const [m, n, p] = ABOVE_size;
		const Biarc_Node_Before_Rearangement = [];
		const Biarc_Node_After_Rearangement = [];
		let Temp_Vertex_Position = null;
		const MyResults = { 'Position': Array.from({ length: m }, () => Array.from({ length: n }, () => Array(p).fill(null))) };
		const RearrangedMyResults = { 'Position': Array.from({ length: m }, () => Array.from({ length: n }, () => Array(p).fill(null))) };
		//const CorrectedMyResults = { 'Position': Array.from({ length: m }, () => Array.from({ length: n }, () => Array(p).fill(null))) };
		if (CorrectedMyResults['Position'].length === 0) {
			CorrectedMyResults['Position'] = Array.from({ length: m }, () => Array.from({ length: n }, () => Array(p).fill(null)));
		}

		for (let i = 0; i < m; i++) {
    		for (let j = 0; j < n; j++) {
        		for (let z = 0; z < p; z++) {
            		let top = ABOVE[i][j][z];
            		let bottom = BELOW[i][j][z];

            		if (!top && !bottom) {
                		MyResults['Position'][i][j][z] = "N/A";
            		} else if (top && !bottom) {
                		MyResults['Position'][i][j][z] = "Up";
            		} else if (!top && bottom) {
                		MyResults['Position'][i][j][z] = "Down";
            		}
        		}
    		}
		}
		//Creating sorted array of the verteces (Prevents error when the number of verteces is lower than the maximum index of the verteces)
		i=0;
		respondedObject.vertex_order.forEach(function(node_tag) {
			let node = getNodeByTag(node_tag);
			Biarc_Node_Before_Rearangement[i]=Number(node);
			//console.error(Number(node));
			i++;
		})
		Biarc_Node_Before_Rearangement.sort((a, b) => a - b);
		//console.error("Sorted Array:", Biarc_Node_Before_Rearangement);
		for (let z = 0; z < n; z++) {
			Biarc_Node_After_Rearangement[z] = Biarc_Node_Before_Rearangement[z];
		}
		//console.error("Sorted Array:", Biarc_Node_After_Rearangement);
		i=0;
		let edges = graphComponent.graph.edges.toArray();
		edges.forEach(function(e) {
			Biarc_Edge_After_Rearangement[i]=parseInt(e.toString(), 10);
			//console.error(parseInt(e.toString(), 10));
			i++;
		})
		Biarc_Edge_After_Rearangement.sort((a, b) => a - b);
		//console.error(Biarc_Edge_After_Rearangement)
		//Swapping Rows to much order of nodes.
    	for (let i = 0; i < m; i++) {
			let j=0;
        	respondedObject.vertex_order.forEach(function(node_tag) {
				let node = getNodeByTag(node_tag);
				for (let z = 0; z < n; z++) {
					if (Biarc_Node_After_Rearangement[z] == Number(node)){
						Temp_Vertex_Position = z;
					}
				}
				//console.error(j.toString() + "this is vetrex" + node.toString())
            	RearrangedMyResults['Position'][i][j] = MyResults['Position'][i][Temp_Vertex_Position];
				j++;
			})
    	}
		//console.error(MyResults['Position'])
		//console.error(RearrangedMyResults['Position'])
		for (let i = 0; i < m; i++) {
    		for (let j = 0; j < n; j++) {
        		for (let z = 0; z < p; z++) {
            		CorrectedMyResults['Position'][i][j][z] = RearrangedMyResults['Position'][i][j][z];
        		}
    		}
		}
		//To avoid adding cases such as: Up Down Down Down Down ... where is basicly a stack edge below,
		//that add complexity to the SAT problem, they are allowed to be and are fixed in here in the solution
		//this step is important to allow the correct and easiest representation of the graph
		for (let i = 0; i < m; i++) {
    		for (let j = 0; j < n - 2; j++) {
        		for (let z = 0; z < p; z++) {
					//prevPos := Previous Position
					//pos := Current Position
					//nextPos := 1st position after pos
					//secNextPos := 2nd position after pos
					//prevPos can not be defined when j = -1 so we set prevPos to Null to avoid further if conditions
					let prevPos = j > 0 ? RearrangedMyResults['Position'][i][j - 1][z] : null;
            		let pos = RearrangedMyResults['Position'][i][j][z];
            		let nextPos = RearrangedMyResults['Position'][i][j + 1][z];
            		let secNextPos = RearrangedMyResults['Position'][i][j + 2][z];

            		if (nextPos !== secNextPos && j === n - 3 && (secNextPos === "Up" || secNextPos === "Down") && (nextPos === "Up" || nextPos === "Down") && (pos === nextPos)) {
						CorrectedMyResults['Position'][i][j + 2][z] = nextPos;
						// ....U U D ---> ...U U U
						//console.error("this is a test"+i.toString()+j.toString()+z.toString())
					}
		
					if (nextPos !== secNextPos && j === n - 3 && (secNextPos === "Up" || secNextPos === "Down") && (nextPos === "Up" || nextPos === "Down") && (pos === "N/A")) {
						CorrectedMyResults['Position'][i][j + 2][z] = nextPos;
						// ....N/A U D ---> ...N/A U U
						//console.error("this is a test_important"+i.toString()+j.toString()+z.toString())
					}
		
					if (pos !== nextPos && (pos === "Up" || pos === "Down") && (nextPos === "Up" || nextPos === "Down")) {
						if (j === 0 && secNextPos === nextPos) {
							CorrectedMyResults['Position'][i][j][z] = nextPos;
							// D U U.... --- >U U U ....
							//console.error("this is a test"+i.toString()+j.toString()+z.toString())
						}

						if (j === 0 && secNextPos === "N/A") {
							CorrectedMyResults['Position'][i][j][z] = nextPos;
							// D U N/A.... --- >U U N/A ....
							//console.error("this is a test_LALALA"+i.toString()+j.toString()+z.toString())
						}
		
						if (prevPos !== pos && nextPos === secNextPos && prevPos === "N/A") {
							CorrectedMyResults['Position'][i][j][z] = nextPos;
							// N/A U D D ---> N/A D D D
							//console.error("this is a test"+i.toString()+j.toString()+z.toString())
						}
		
						if (prevPos !== pos && nextPos !== secNextPos && prevPos === "N/A") {
							CorrectedMyResults['Position'][i][j][z] = nextPos;
							// N/A D U D D D  ---> N/A U U D D D
							//console.error("this is a test"+i.toString()+j.toString()+z.toString())
						}
		
						if (prevPos === pos && nextPos !== secNextPos && secNextPos === "N/A") {
							CorrectedMyResults['Position'][i][j + 1][z] = pos;
							// D D U N/A ---> D D D N/A
							//console.error("this is a test"+i.toString()+j.toString()+z.toString())
						}
		
						if (prevPos !== pos && nextPos !== secNextPos && secNextPos === "N/A" && (prevPos === "Up" || prevPos === "Down")) {
							CorrectedMyResults['Position'][i][j + 1][z] = pos;
							// D D D U D N/A  ---> D D D U U N/A
							//console.error("this is a test"+i.toString()+j.toString()+z.toString())
						}

						if (j === 1 && prevPos !== pos && nextPos === secNextPos && prevPos == nextPos && (secNextPos === "Up" || secNextPos === "Down") && (prevPos === "Up" || prevPos === "Down")) {
							CorrectedMyResults['Position'][i][j-1][z] = pos;
							// D U D D D N/A  ---> U U D D D N/A
							//console.error("this is a testNEW"+i.toString()+j.toString()+z.toString())
						}
		
						if (prevPos === "N/A" && secNextPos === "N/A") {
							CorrectedMyResults['Position'][i][j][z] = nextPos;
							// N/A U D N/A ---> N/A D D N/A 
							//console.error("this is a test"+i.toString()+j.toString()+z.toString())
						}
					}
				}
			}
        }
	}

	function updatePagesWithConstraints(pages) {
		// updates the pages with constraints
		pages.forEach(function(p) {
			var id = p.id.slice(1)
			$("#page" + id).prop("checked", true);
			$("#page" + id).button("refresh");
			$("#page" + id).checkboxradio({
				disabled: false
			})
			$("#typeP" + id).selectmenu({
				disabled: false
			})
			$("#typeP" + id).val(p.type)
			$("#typeP" + id).selectmenu("refresh")
			$("#layoutP" + id).selectmenu({
				disabled: false
			})
			$("#layoutP" + id).val(p.constraint)
			$("#layoutP" + id).selectmenu("refresh")
			$("#page" + (parseInt(id)+1)).checkboxradio({
				disabled: false
			})
		})
	}
     // Reload selected constraints with new constraints array
	function updateSelectedConstraints() {
		for (let key of Object.keys(selectedConstraints)) {
			selectedConstraints[key] = constraintsArray[key]
		}
	}
	// Find node by tag and return that node instance
	function getNodeByTag(tag){
		for(let node of graphComponent.graph.nodes.toArray()) {
			if (node.tag.toString() === tag.toString()){
				return node;
			}
		}
	}

	// Calculate Arc Height of the edge
	function getArcHeight(edge) {
		const source = edge.sourceNode.layout.center;
		const target = edge.targetNode.layout.center;
		const distance = source.distanceTo(target);
		return Math.abs(distance/5);
	}

	// Get default color
	function getDefaultColor(pageNumber) {
//		const colors = ["#FF0000", "#0000FF", "#00FF00", "#000000"];
 var initialColors = ["#FF0000","#0000FF", "#00FF00", "#7E7E7E", "#8A2BE2",  "#FFFF00", "#15E2CB", "#FF007F", "#FF8300", "#000000"];
    var colors = new Array(numberOfPages)
    for ( var i = 0; i<colors.length; i++)
    {
    if (i <= initialColors.length)
    {colors[i] = initialColors[i]}
    else {
    colors[i] = "#000000"
    }
    }
		return colors[(pageNumber-1)];
	}

	// Returns thickness for a stroke of a node
	function getNodeStrokeThickness() {
		const maxThickness = originalNodeWidth + 100;  // Limiting maximum thickness
		let thickness = 5 + getNumberOfVisibleNodes() * 0.5;
		if (thickness > maxThickness) {
			thickness = maxThickness;
		}
		return thickness;
	}

	// Returns thickness for a stroke of a edge
	function getEdgeStrokeThickness() {
		const maxThickness = 30; // Hard limit
		let thickness = Math.round(5 + Math.pow(1.055, getNumberOfVisibleNodes()));
		if (thickness > maxThickness) {
			thickness = maxThickness;
		}
		return thickness;
	}

	// DEFAULT
	function getNodeDefaultFillColor() {
		return '#FFA500';
	}

	// DEFAULT
	function getNodeDefaultShape() {
		return 'ellipse';
	}

	// DEFAULT
	function getNodeDefaultStroke() {
		return 'white';
	}

	// DEFAULT
	function getNodeStrokeDefaultThickness() {
		return 0;
	}

	// DEFAULT
	function getEdgeStrokeDefaultThickness() {
		return 2;
	}

	// DEFAULT
	function getNodeStrokeDefaultLineStyle() {
		return 'solid';
	}

	// DEFAULT
	function getEdgeStrokeDefaultLineStyle() {
		return 'solid';
	}

	// Create stroke string
	function getStrokeString(thickness, lineStyle, color) {
		return thickness + "px " + lineStyle + " " + color;
	}


	// Returns width and height of a highlighted node
	function getNodeSizeForHighlighting() {
		const maxWidthSize = originalNodeWidth + 100; // Limiting maximum width
		const maxHeightSize = originalNodeHeight + 100; // Limiting maximum height
		let width = originalNodeWidth + 10 + getNumberOfVisibleNodes() * 0.6;
		let height = originalNodeHeight + 10 + getNumberOfVisibleNodes() * 0.6;
		if (width > maxWidthSize) {
			width = maxWidthSize;
		}
		if (height > maxHeightSize) {
			height = maxHeightSize;
		}
		return { width, height };
	}

	// Returns Page Index from pagesArray using Edge
	function getPageIndex(edge) {
		let i;
		// pagesArray = [[edges],[edges]]
		for(i=0; i < pagesArray.length; i++) {
			if(pagesArray[i].includes(edge)) {
				return i;
			}
		}
	}

	// Returns deque edge type from DeqTypesMap for an Edge
	function getDequeType(edge) {
		let type;
		DeqTypesMap.forEach(function(value, key) {
			if(value.includes(edge)) {
				type = key;
			}
		})
		return type;
	}

	// Get number of visible nodes on the UI based on the layout
	function getNumberOfVisibleNodes() {
		if(currentLayout === LayoutOption.CONSTRAINED){
			let numberOfVisibleNodes = 0;
			for(const node of graphComponent.graph.nodes.toArray()) {
				// If style is VoidNodeStyle that means node is hidden
				if (!node.style instanceof yfiles.styles.VoidNodeStyle) {
					numberOfVisibleNodes += 1;
				}
			}
			return numberOfVisibleNodes;
		}
		return graphComponent.graph.nodes.toArray().length;
	}


	/*
	----------------------------------------------------------------------------------------------
		Highlight Constraints Functions
	----------------------------------------------------------------------------------------------
	*/

     // Refresh styles of nodes and edges
	function refreshStyling(directed) {
		const data = getAllNodesAndEdgesWithNeighborsOfConstraints(Object.values(selectedConstraints));

		// For nodes
		if (currentLayout === LayoutOption.CONSTRAINED) {
			for(let node of data.neighborNodes) {
				setNodeStyle(node);
				setNodeLayout(node);
			}
		}
		else {
			for(let node of graphComponent.graph.nodes.toArray()) {
				setNodeStyle(node);
				setNodeLayout(node);
			}
		}

		for(let node of data.nodesOfConstraints){
			highlightNodeStyle(node);
		}

        // For edges
		let pageNumber;
		for(pageNumber=1; pageNumber <= pagesArray.length; pageNumber++){
			updateEdgesOfPageAndPageOptions(pageNumber, directed);
		}
	}

	// Highlight and set edge arc style
	function highlightEdgeArcStyle(edge, directed){
		let pageNumber = getPageIndex(edge) + 1;
		let color = colorsOfPages[pageNumber - 1];
		let placing = $("#placingPage" + pageNumber).val().slice(0,5);
		let height = (placing === "below") ? -getArcHeight(edge): getArcHeight(edge)
		let stroke = getStrokeString(getEdgeStrokeThickness(), getEdgeStrokeDefaultLineStyle(), color);
		// Set Style
		graphComponent.graph.setStyle(edge, getEdgeArcStyle(color, height, stroke, directed));
	}

	// Highlight and set edge polyline style
	function highlightEdgePolylineStyle(edge, directed) {
		let pageNumber = getPageIndex(edge) + 1;
		let color = colorsOfPages[pageNumber - 1];
		let stroke = getStrokeString(getEdgeStrokeThickness(), getEdgeStrokeDefaultLineStyle(), color);
		// Set Style
		graphComponent.graph.setStyle(edge, getEdgePolylineStyle(color, stroke, directed));
	}

	// Highlight and set edge style
	function highlightEdgeStyle(edge, layoutOption, directed) {
		if (layoutOption === LayoutOption.LINEAR || (layoutOption === LayoutOption.CONSTRAINED && previousLayout === LayoutOption.LINEAR)) {
			highlightEdgeArcStyle(edge, directed);
		}
		else if (layoutOption === LayoutOption.CIRCULAR || (layoutOption === LayoutOption.CONSTRAINED && previousLayout === LayoutOption.CIRCULAR)) {
			highlightEdgePolylineStyle(edge, directed);
		}
	}

	// Highlight and set node style
	function highlightNodeStyle(node) {
		setLabelsStyle(node);
		let fillColor = "#00A3E8";
		let shape = getNodeDefaultShape();
		let strokeColor = "rgba(0,162,232,0.2)"; // #00A3E8 0.2 ==> transparency
 		let stroke = getStrokeString(getNodeStrokeThickness(), getNodeStrokeDefaultLineStyle(), strokeColor);
		graphComponent.graph.setStyle(node, getNodeStyle(fillColor, shape, stroke));
		let nodeSize = getNodeSizeForHighlighting();
		let x = node.layout.x;
		let y = node.layout.y;
		graphComponent.graph.setNodeLayout(node, new yfiles.geometry.Rect(x, y, nodeSize.width, nodeSize.height));
	}

	// Highlight Linear, Circular, Constrained Button
	function highlightLayoutOptions(layoutEnum){
		switch(layoutEnum){
			case LayoutOption.LINEAR:
				$("#lineLayoutButtonLabel").css("color", "#00A3E8");
				$("#circLayoutButtonLabel").css("color", "black");
				$("#consLayoutButtonLabel").css("color", "black");
				$("#matrixLayoutButtonLabel").css("color", "black");
				break;
			case LayoutOption.CIRCULAR:
				$("#lineLayoutButtonLabel").css("color", "black");
				$("#circLayoutButtonLabel").css("color", "#00A3E8");
				$("#consLayoutButtonLabel").css("color", "black");
				$("#matrixLayoutButtonLabel").css("color", "black");
				break;
			case LayoutOption.CONSTRAINED:
				$("#lineLayoutButtonLabel").css("color", "black");
				$("#circLayoutButtonLabel").css("color", "black");
				$("#consLayoutButtonLabel").css("color", "#00A3E8");
				$("#matrixLayoutButtonLabel").css("color", "black");
				break;
			case LayoutOption.MATRIX:
				$("#lineLayoutButtonLabel").css("color", "black");
				$("#circLayoutButtonLabel").css("color", "black");
				$("#consLayoutButtonLabel").css("color", "black");
				$("#matrixLayoutButtonLabel").css("color", "#00A3E8");
				break;
		}
	}


	// Give border color to the tag of the constraint on UI
	function highlightConstraintTagUsingIndex(constraintIndex) {
		  // Edit CSS style of the tag
		  $("#constraintTags").find("li").eq(constraintIndex).css({
					"border-style": "solid",
					"border-width": "3px",
					"border-color": "#FFA500" // Orange
			});
	}


	// Remove border color to the tag of the constraint on UI
	function removeHighlightConstraintTagUsingIndex(constraintIndex) {
		  // Edit CSS style of the tag
		  $("#constraintTags").find("li").eq(constraintIndex).css({
					"border-style": "solid",
					"border-width": "1px",
					"border-color": "#c5c5c5" // Grey
			});
	}



	/*
	----------------------------------------------------------------------------------------------
		Page Functions
	----------------------------------------------------------------------------------------------
	*/

	// Disable Above/Below page options
	function disablePageOptions(pageNumber) {
		$("#placingPage"+ pageNumber).selectmenu({disabled:true});
	}

	// Enable Above/Below page options
	function enablePageOptions(pageNumber) {
		if ($("#displayPage" + pageNumber).prop("checked")) {
			$("#placingPage" + pageNumber).selectmenu({disabled:false});
		}
	}

	// Disable all page options ==> Above/Below
	function disableAllPagesOptions() {
		let i;
		for(i=0; i<pagesArray.length; i++) {
			disablePageOptions(i + 1);
		}
	}

	// Enable all page options ==> Above/Below
	function enableAllPagesOptions() {
		let i;
		for(i=0; i<pagesArray.length; i++) {
			enablePageOptions(i + 1);
		}
	}

	function updateColorArray(pageNumber, color) {
		colorsOfPages[pageNumber - 1] = color;
	}

	function updateEdgesOfPageAndPageOptions(pageNumber, directed) {
		if($("#displayPage" + pageNumber).prop("checked")) {
			if (currentLayout === LayoutOption.LINEAR ||
				(currentLayout === LayoutOption.CONSTRAINED && previousLayout === LayoutOption.LINEAR)){
				enablePageOptions(pageNumber);
			}
			setAndHighlightEdgesOfPage(pageNumber, currentLayout, directed);
		}
		else{
			disablePageOptions(pageNumber);
			hideEdgesOfPage(pageNumber);
		}
	}
	/*
	----------------------------------------------------------------------------------------------
		Hide & UnHide Functions
	----------------------------------------------------------------------------------------------
	*/

    // Hide nodes and edges and labels
	function hideEveryone(){
		for (let node of graphComponent.graph.nodes.toArray()) {
			graphComponent.graph.setStyle(node, getNodeStyleForHiding());
			hideLabels(node);
		}
		for (let edge of graphComponent.graph.edges.toArray()) {
			graphComponent.graph.setStyle(edge, getEdgeStyleForHiding());
			hideLabels(edge);
		}
	}

	// LABELS

	// Hide Labels
	function hideLabels(nodeOrEdge){
		for(let label of nodeOrEdge.labels.toArray()) {
			graphComponent.graph.setStyle(label, getLabelStyleForHiding());
		}
	}

	// EDGES

	// Hide Edges with labels
	function hideEdgeWithLabels(edge){
		graphComponent.graph.setStyle(edge, getEdgeStyleForHiding());
		hideLabels(edge);
	}

	// Hide Edges of the page number provided
	function hideEdgesOfPage(pageNumber){
		if (currentLayout === LayoutOption.MATRIX) {
			for(let edge of pagesArray[pageNumber - 1]) {
				for(let node of graphComponent.graph.nodes.toArray()) {
					if(node.tag === "matrix" && node.labels.toArray()[0].text === edge.labels.toArray()[0].text) {
						graphComponent.graph.setStyle(node, getNodeStyleForHiding());
						hideLabels(node);
					}
				}
			}
		} else {
			for(let edge of pagesArray[pageNumber - 1]) {
		//	for(let edge of pagesArray[pageNumber]) {
				hideEdgeWithLabels(edge);
			}
		}
	}


	function setAndHighlightEdgesOfPage(pageNumber, layoutOption, directed) {
	    // All the edges on a particular page ==> given pagenumber
	    // Set it(default style) and highlight it

		const data = getAllNodesAndEdgesWithNeighborsOfConstraints(Object.values(selectedConstraints));
		if (layoutOption === LayoutOption.CONSTRAINED){
			// unHide only those that are a part of constraint edges or neighbors
			// highlight only selected ones
			for(let edge of pagesArray[pageNumber - 1]) {
				if(data.neighborEdges.includes(edge)){
					setLabelsStyle(edge);
					setEdgeStyle(edge, previousLayout, directed);
				}
				if(data.edgesOfConstraints.includes(edge)){
					setLabelsStyle(edge);
					highlightEdgeStyle(edge, previousLayout, directed);
				}
			}
		}
		else {
			// unHide everyone and highlight only selected ones
			if(currentLayout === LayoutOption.MATRIX) {


			} else {
				for(let edge of pagesArray[pageNumber - 1]) {
					setLabelsStyle(edge);
					if(data.edgesOfConstraints.includes(edge)){
						highlightEdgeStyle(edge, layoutOption, directed);
					}
					else{
						setEdgeStyle(edge, layoutOption, directed);
					}
				}
			}
		}
	}


	/*
	----------------------------------------------------------------------------------------------
		Constraints Functions
	----------------------------------------------------------------------------------------------
	*/

    // Get node and edge and all the neighbours of selected constraints
	function getAllNodesAndEdgesWithNeighborsOfConstraints(constraints){
		let neighborNodes = [];
		let neighborEdges = [];
		let nodesOfConstraints = [];
		let edgesOfConstraints = [];

		for(let constraint of constraints){
			for(let obj of constraint.objects){
				if (Array.isArray(obj)) {
					for(let o of obj){
						if (yfiles.graph.INode.isInstance(o)){
							var localNeighborNodes = graphComponent.graph.neighbors(o).toArray();
							var localNeighborEdges = graphComponent.graph.edgesAt(o).toArray();
							localNeighborNodes.forEach(function(n){
								if(!neighborNodes.includes(n)){
									neighborNodes.push(n);
								}
							})
							localNeighborEdges.forEach(function(e){
								if(!neighborEdges.includes(e)){
									neighborEdges.push(e);
								}
							})
							if(!nodesOfConstraints.includes(o)){
								nodesOfConstraints.push(o);
							}
						}
						else if (yfiles.graph.IEdge.isInstance(o)){
							// Add source node to neighbor node
							if(!neighborNodes.includes(o.sourceNode)){
								neighborNodes.push(o.sourceNode);
							}
							// Add target node to neighbor node
							if(!neighborNodes.includes(o.targetNode)){
								neighborNodes.push(o.targetNode);
							}
							if(!edgesOfConstraints.includes(o)){
								edgesOfConstraints.push(o);
							}
						}
					}
				}
				else {
					if (yfiles.graph.INode.isInstance(obj)){
						var localNeighborNodes = graphComponent.graph.neighbors(obj).toArray();
						var localNeighborEdges = graphComponent.graph.edgesAt(obj).toArray();
						localNeighborNodes.forEach(function(n){
							if(!neighborNodes.includes(n)){
								neighborNodes.push(n);
							}
						})
						localNeighborEdges.forEach(function(e){
							if(!neighborEdges.includes(e)){
								neighborEdges.push(e);
							}
						})
						if(!nodesOfConstraints.includes(obj)){
							nodesOfConstraints.push(obj);
						}
					}
					else if (yfiles.graph.IEdge.isInstance(obj)){
						// Add source node to neighbor node
						if(!neighborNodes.includes(obj.sourceNode)){
							neighborNodes.push(obj.sourceNode);
						}
						// Add target node to neighbor node
						if(!neighborNodes.includes(obj.targetNode)){
							neighborNodes.push(obj.targetNode);
						}
						if(!edgesOfConstraints.includes(obj)){
							edgesOfConstraints.push(obj);
						}
					}
				}
			}
		}

		return {
			nodesOfConstraints, edgesOfConstraints, neighborNodes, neighborEdges
		}
	}

	/*
	----------------------------------------------------------------------------------------------
		Styling Functions
	----------------------------------------------------------------------------------------------
	*/

	// Set Label style
	function setLabelsStyle(nodeOrEdge){
		const labels = nodeOrEdge.labels.toArray();
		labels.forEach(function(label) {
			graphComponent.graph.setStyle(label, getLabelStyle());
		})
	}

	// Set edge arc style
	function setEdgeArcStyle(edge, directed) {
		let pageNumber = getPageIndex(edge) + 1;
		let color = colorsOfPages[pageNumber - 1];
		let placing = $("#placingPage" + pageNumber).val().slice(0,5);
		let factor = 1;
		if (edge.sourceNode == predecessors.get(edge.targetNode) || edge.targetNode == predecessors.get(edge.sourceNode)) {
			factor *= 1.5; 
		}
		let stroke = getStrokeString(factor * getEdgeStrokeDefaultThickness(), getEdgeStrokeDefaultLineStyle(), color);
		if (placing === "deque") {
			setEdgeArcStyleDequePage(edge, directed, color, placing, stroke);
		} else if (placing === "biarc") {
			setEdgeArcStyleBiarcPage(edge, directed, color, placing, stroke);
		} else {
			let height = (placing === "below") ? -getArcHeight(edge) : getArcHeight(edge);
			graphComponent.graph.setStyle(edge, getEdgeArcStyle(color, height, stroke, directed));
		}
	}

	function setEdgeArcStyleDequePage(edge, directed, color, placing, stroke) {
		let type = getDequeType(edge);
		let height;
		let style;
		let point_x;
		let point_y;
		if (type === "TAIL") {
			height = -getArcHeight(edge);
			graphComponent.graph.setStyle(edge, getEdgeArcStyle(color, height, stroke, directed));
		} else if (type === "HEAD") {
			height = getArcHeight(edge);
			graphComponent.graph.setStyle(edge, getEdgeArcStyle(color, height, stroke, directed));
		} else if (type === "QUEUE_H_T") {
			if (edge.bends.toArray().length == 0) {
				let max_distance = nextNodex + (nextNodex / 200) * 20;
				let helper_distance = max_distance - (edge.targetNode.layout.x / 200) * 20;
				const helper_node = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(helper_distance, 0));
				const above_port = graphComponent.graph.addPort(edge.sourceNode, yfiles.graph.FreeNodePortLocationModel.NODE_RIGHT_ANCHORED);
				const below_port = graphComponent.graph.addPort(edge.targetNode, yfiles.graph.FreeNodePortLocationModel.NODE_LEFT_ANCHORED);
				const helper_edge_above = graphComponent.graph.createEdge(edge.sourceNode, helper_node);
				const helper_edge_below = graphComponent.graph.createEdge(helper_node, edge.targetNode);
				graphComponent.graph.setEdgePorts(helper_edge_above, above_port, helper_node.ports.toArray()[0]);
				graphComponent.graph.setEdgePorts(helper_edge_below, helper_node.ports.toArray()[0], below_port);
				// add bends based on points
				Array.from(new Array(101), (x, i) => {
					style = getEdgeArcStyle(color, getArcHeight(helper_edge_above), stroke, directed);
					point_x = style.renderer.getPathGeometry(helper_edge_above, style).getPath().getPoint(i/100).x
					point_y = style.renderer.getPathGeometry(helper_edge_above, style).getPath().getPoint(i/100).y
					graphComponent.graph.addBend(edge, new yfiles.geometry.Point(point_x-10, point_y));
				});
				Array.from(new Array(101), (x, i) => {
					style = getEdgeArcStyle(color, getArcHeight(helper_edge_below), stroke, directed);
					point_x = style.renderer.getPathGeometry(helper_edge_below, style).getPath().getPoint(i/100).x
					point_y = style.renderer.getPathGeometry(helper_edge_below, style).getPath().getPoint(i/100).y
					graphComponent.graph.addBend(edge, new yfiles.geometry.Point(point_x+10, point_y));
				});
				graphComponent.graph.remove(helper_node);
			}
			graphComponent.graph.setStyle(edge, getEdgeBezierStyle(color, stroke, directed));
		} else if (type === "QUEUE_T_H") {
			if (edge.bends.toArray().length == 0) {
				let max_distance = nextNodex + (nextNodex / 100) * 10;
				let helper_distance = max_distance - (edge.sourceNode.layout.x / 100) * 10;
				const helper_node = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(helper_distance, 0));
				const below_port = graphComponent.graph.addPort(edge.sourceNode, yfiles.graph.FreeNodePortLocationModel.NODE_LEFT_ANCHORED);
				const above_port = graphComponent.graph.addPort(edge.targetNode, yfiles.graph.FreeNodePortLocationModel.NODE_RIGHT_ANCHORED);
				const helper_edge_below = graphComponent.graph.createEdge(edge.sourceNode, helper_node);
				const helper_edge_above = graphComponent.graph.createEdge(helper_node, edge.targetNode);
				graphComponent.graph.setEdgePorts(helper_edge_below, below_port, helper_node.ports.toArray()[0]);
				graphComponent.graph.setEdgePorts(helper_edge_above, helper_node.ports.toArray()[0], above_port);
				// add bends based on points
				Array.from(new Array(101), (x, i) => {
					style = getEdgeArcStyle(color, getArcHeight(helper_edge_below), stroke, directed);
					point_x = style.renderer.getPathGeometry(helper_edge_below, style).getPath().getPoint(i/100).x
					point_y = style.renderer.getPathGeometry(helper_edge_below, style).getPath().getPoint(i/100).y
					graphComponent.graph.addBend(edge, new yfiles.geometry.Point(point_x-10, -point_y+10));
				});
				Array.from(new Array(101), (x, i) => {
					style = getEdgeArcStyle(color, getArcHeight(helper_edge_above), stroke, directed);
					point_x = style.renderer.getPathGeometry(helper_edge_above, style).getPath().getPoint(i/100).x
					point_y = style.renderer.getPathGeometry(helper_edge_above, style).getPath().getPoint(i/100).y
					graphComponent.graph.addBend(edge, new yfiles.geometry.Point(point_x, -point_y+20));
				});
				graphComponent.graph.remove(helper_node);
			}
			graphComponent.graph.setStyle(edge, getEdgeBezierStyle(color, stroke, directed));
		}
	}

	function setEdgeArcStyleBiarcPage(edge, directed, color, placing, stroke){
		let Edge_As_Integer = parseInt(edge.toString(), 10);
		let Temp_Edge_Position=null;
		for (let i = 0; i < Biarc_Edge_After_Rearangement.length; i++) {
			if (Biarc_Edge_After_Rearangement[i] == Edge_As_Integer) {
				Temp_Edge_Position = i;
			}
			
		}
		const  CorrectedMyResults_size= [CorrectedMyResults['Position'].length, CorrectedMyResults['Position'][0].length, CorrectedMyResults['Position'][0][0].length];
		const [m, n, p] = CorrectedMyResults_size;
		let Source_Node = null;
		let Target_Node = null;
		let Switch_Node = null;
		let height;
		let Source_Found = false;
		let Target_Found = false;
		let Is_Biarc = false;
		let height_First_Part;
		let height_Second_Part;
		let Temp_Position_A = null;
		let Temp_Position_B = null;
		let helper_distance;
		let style;
		let Source_Port;
		let Target_Port;
		let point_x;
		let point_y;
		let Count_A;
		let Count_B;
		let Count_All;
		graphComponent.graph.clearBends(edge);
		for (let i = Temp_Edge_Position; i <Temp_Edge_Position+1; i++) {
			//console.error(Edge_As_Integer)
			//console.error(Temp_Edge_Position)
			Source_Found = false;
			Target_Found = false;
			Is_Biarc = false;
			Temp_Position_A = null;
		    Temp_Position_B = null;
			Count_A = 0; 
			Count_B = 0;
			Count_All = 0;
    		for (let j = 0; j < n; j++) {
        		for (let z = 0; z < p; z++) {
					//Because we don't have the list of edges in the right order, a search is performed
					//Because verteces are in the order they are represended its obvious that the first 'Up' or 'Down' after a 'N/A' is the rightmsot endpoint of the edge
					//Simillar the Last 'Up' or 'Down' before a 'N/A' is the other endpoint
					//First the source of the edge is found
            		if (CorrectedMyResults['Position'][i][j][z] !== "N/A" && Source_Found !== true) {
						Source_Node = respondedObject.vertex_order[j];
						Source_Found = true;
						Temp_Position_A = CorrectedMyResults['Position'][i][j][z];
					}
					//Then the target is found
					if (j < n-1 && Source_Found === true) {
						if (CorrectedMyResults['Position'][i][j][z] !== "N/A" && CorrectedMyResults['Position'][i][j+1][z] === "N/A" && Target_Found !== true) {
							Target_Node = respondedObject.vertex_order[j];
							Target_Found = true;
							Temp_Position_B = CorrectedMyResults['Position'][i][j][z];
						}
					}
					if (j == n-1 && Source_Found === true){
						if ((CorrectedMyResults['Position'][i][j][z] === "Up" || CorrectedMyResults['Position'][i][j][z] === "Down") && (j = n-1) && Target_Found !== true) {
							Target_Node = respondedObject.vertex_order[j];
							Target_Found = true;
							Temp_Position_B = CorrectedMyResults['Position'][i][j][z];
						}
					}
					if (j < n-1 && Source_Found === true && Target_Found !== true) {
						//If right after an 'Up' there is a 'Down' or vice versa then this edge is marked as biarc
						if (CorrectedMyResults['Position'][i][j][z] !== "N/A" && CorrectedMyResults['Position'][i][j][z] !== CorrectedMyResults['Position'][i][j+1][z] && CorrectedMyResults['Position'][i][j+1][z] !== "N/A") {
							Switch_Node = respondedObject.vertex_order[j+1];
							Is_Biarc = true;
						}
						//Count_A is how many continious 'Up' or 'Down' we have before the switch
						if (CorrectedMyResults['Position'][i][j][z] !== "N/A" && CorrectedMyResults['Position'][i][j][z] === CorrectedMyResults['Position'][i][j+1][z] && CorrectedMyResults['Position'][i][j][z] === Temp_Position_A) {
							Count_A = Count_A + 1;
						}
						//Count_B is how many continious 'Up' or 'Down' we have after the switch
						if (CorrectedMyResults['Position'][i][j][z] !== "N/A" && CorrectedMyResults['Position'][i][j][z] === CorrectedMyResults['Position'][i][j+1][z] && CorrectedMyResults['Position'][i][j][z] !== Temp_Position_A) {
							Count_B = Count_B + 1;
						}
					}
					if (CorrectedMyResults['Position'][i][j][z] !== "N/A") {
						Count_All = Count_All + 1;
					}
					//if both endpoints are found and edge is marked as biarc then it is represended
					//console.error(CorrectedMyResults['Position'])
					if (Source_Found === true && Target_Found === true && Is_Biarc === true) {
						if (edge.bends.toArray().length == 0) {
							//console.error("source dist : "+edge.sourceNode.layout.x +" and target dist : "+ edge.targetNode.layout.x);
							//set helper node position on switch point (note that source might be fourther than target)
							//slight deviation is created with count_A and count_B to avoid overlaping parts of biarcs
							if (edge.sourceNode.layout.x < edge.targetNode.layout.x){
								helper_distance = ((edge.sourceNode.layout.x + ((Count_A) * node_distance)) + node_distance/2 + Count_A*5.5 - Count_B*5.5); 
							}
							if (edge.sourceNode.layout.x > edge.targetNode.layout.x){
								helper_distance = ((edge.targetNode.layout.x + ((Count_A) * node_distance)) + node_distance/2 + Count_A*5.5 - Count_B*5.5); 
							}
							const helper_node = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(helper_distance, 15));
							//Instead one edge from u to v we make a stack edge from u to the helper_node and one from the helper_node to v
							//This edges are guidelines and will only be used to help place the original edge in the correct position
							const helper_edge_First_Part = graphComponent.graph.createEdge(edge.sourceNode, helper_node);
							const helper_edge_Second_part = graphComponent.graph.createEdge(helper_node, edge.targetNode);
							if (Temp_Position_A == "Up") {
								height_First_Part = getArcHeight(helper_edge_First_Part); // first part is Up
								height_Second_Part = -getArcHeight(helper_edge_Second_part); // second part is Down
							}
							if (Temp_Position_A == "Down") {
								height_First_Part = -getArcHeight(helper_edge_First_Part); // first part is Down
								height_Second_Part = getArcHeight(helper_edge_Second_part); // second part is Up
							}
							graphComponent.graph.setStyle(helper_edge_First_Part, getEdgeArcStyle(color, height_First_Part, stroke, directed));
							graphComponent.graph.setStyle(helper_edge_Second_part, getEdgeArcStyle(color, height_Second_Part, stroke, directed));
							if (edge.sourceNode.layout.x < edge.targetNode.layout.x){
								Source_Port = graphComponent.graph.addPort(edge.sourceNode, yfiles.graph.FreeNodePortLocationModel.NODE_LEFT_ANCHORED);
								Target_Port = graphComponent.graph.addPort(edge.targetNode, yfiles.graph.FreeNodePortLocationModel.NODE_RIGHT_ANCHORED);
							}
							if (edge.sourceNode.layout.x > edge.targetNode.layout.x){
								Target_Port = graphComponent.graph.addPort(edge.sourceNode, yfiles.graph.FreeNodePortLocationModel.NODE_LEFT_ANCHORED);
								Source_Port = graphComponent.graph.addPort(edge.targetNode, yfiles.graph.FreeNodePortLocationModel.NODE_RIGHT_ANCHORED);
							}
							//set several ports on the first helper edge to guide the first part of the original edge
							Array.from(new Array(201), (x, i) => {
								style = getEdgeArcStyle(color, getArcHeight(helper_edge_First_Part), stroke, directed);
								point_x = style.renderer.getPathGeometry(helper_edge_First_Part, style).getPath().getPoint(i/200).x-22
								point_y = style.renderer.getPathGeometry(helper_edge_First_Part, style).getPath().getPoint(i/200).y-15//-(-15 / (1 +  Math.exp(-0.1 * (i - 100))))//-(Count_All-Count_A)*(0.08)*(220/i)
								if (height_First_Part > 0){
									graphComponent.graph.addBend(edge, new yfiles.geometry.Point(point_x+22, point_y+15));
								}
								if (height_First_Part < 0){
									graphComponent.graph.addBend(edge, new yfiles.geometry.Point(point_x+22, -point_y+15));
								}
							});
							//set several ports on the second helper edge to guide the second part of the original edge
							Array.from(new Array(201), (x, i) => {
								style = getEdgeArcStyle(color, getArcHeight(helper_edge_Second_part), stroke, directed);
								point_x = style.renderer.getPathGeometry(helper_edge_Second_part, style).getPath().getPoint(i/200).x-22
								point_y = style.renderer.getPathGeometry(helper_edge_Second_part, style).getPath().getPoint(i/200).y-15//-(-15 / (1 +  Math.exp(-0.1 * (i - 100))))
								if (height_Second_Part > 0){
									graphComponent.graph.addBend(edge, new yfiles.geometry.Point(point_x+22, point_y+15));
								}
								if (height_Second_Part < 0){
									graphComponent.graph.addBend(edge, new yfiles.geometry.Point(point_x+22, -point_y+15));
								}
							});
							//remove helper node (also removes helper edges)
							graphComponent.graph.remove(helper_node);
							graphComponent.graph.setStyle(edge, getEdgeBezierStyle(color, stroke, directed));
							break;
						}
	
					}
					//if the edge is not marked as biarc then its drawn as stack edge
					if (Source_Found === true && Target_Found === true && Is_Biarc === false) {
						if (Temp_Position_A === "Up") {
							height = getArcHeight(edge);
							graphComponent.graph.setStyle(edge, getEdgeArcStyle(color, height+5, stroke, directed));
						}
						if (Temp_Position_A === "Down") {
							height = -getArcHeight(edge);
							graphComponent.graph.setStyle(edge, getEdgeArcStyle(color, height-5, stroke, directed));
						}
						break;
					}
					graphComponent.graph.setStyle(edge, getEdgeBezierStyle(color, stroke, directed));

        		}
    		}
		}
	}

	function cleanUpEdgeArcStyleDequePage() {
		graphComponent.graph.edges.toArray().forEach(function(e) {
			graphComponent.graph.clearBends(e);
		})
	}

	// Set edge polyline style
	function setEdgePolylineStyle(edge, directed) {
		let pageNumber = getPageIndex(edge) + 1;
		let color = colorsOfPages[pageNumber - 1];
		let factor = 1;
		if (edge.sourceNode == predecessors.get(edge.targetNode) || edge.targetNode == predecessors.get(edge.sourceNode)) {
			factor *= 2; 
		}
		let stroke = getStrokeString(factor * getEdgeStrokeDefaultThickness(), getEdgeStrokeDefaultLineStyle(), color);
		graphComponent.graph.setStyle(edge, getEdgePolylineStyle(color, stroke, directed));
	}
	
	// Set edge style
	function setEdgeStyle(edge, layoutOption, directed) {
		if (layoutOption === LayoutOption.LINEAR || (layoutOption === LayoutOption.CONSTRAINED && previousLayout === LayoutOption.LINEAR)) {
			setEdgeArcStyle(edge, directed);
		}
		else if (layoutOption === LayoutOption.CIRCULAR || (layoutOption === LayoutOption.CONSTRAINED && previousLayout === LayoutOption.CIRCULAR)) {
			setEdgePolylineStyle(edge, directed);
		}
	}

	// Set ShapeNodeStyle for Node and also set Labels
	function setNodeStyle(node) {
		setLabelsStyle(node);
		graphComponent.graph.setStyle(node, getNodeDefaultStyle());
	}

	// Set Node layout
	function setNodeLayout(node) {
		let x = node.layout.x;
		let y = node.layout.y;
		let width = 30;
		let height = 30;
		graphComponent.graph.setNodeLayout(node, new yfiles.geometry.Rect(x, y, width, height));
	}

	// LABEL STYLES

	function getLabelStyle(){
		return new yfiles.styles.DefaultLabelStyle({
			//TODO how to place the label at the center of the arc
		});
	}

	// NODE STYLES

	// Returns default node style
	function getNodeDefaultStyle() {
		return getNodeStyle(getNodeDefaultFillColor(), getNodeDefaultShape(), getNodeDefaultStroke());
	}

	// Returns Node style ShapeNodeStyle
	function getNodeStyle(fillColor, shape, stroke) {
		return new yfiles.styles.ShapeNodeStyle({
			fill: fillColor,
			shape: shape,
			stroke: stroke,
		});
	}

	// EDGE STYLES

	// Returns edge arc style
	function getEdgeArcStyle(color, height, stroke, directed) {
	    const targetArrowStyle = new yfiles.styles.Arrow({
            type: yfiles.styles.ArrowType.DEFAULT,
            stroke: color,
            fill: color
          })
		if(directed){
			return new yfiles.styles.ArcEdgeStyle({
				height: height,
				provideHeightHandle: false,
				stroke: stroke,
				targetArrow: targetArrowStyle
				//targetArrow: yfiles.styles.IArrow.DEFAULT
			});
		}
		return new yfiles.styles.ArcEdgeStyle({
			height: height,
			provideHeightHandle: false,
			stroke: stroke
		});
	}

	// Returns edge style for deque edges
	function getEdgeBezierStyle(color, stroke, directed) {
		const targetArrowStyle = new yfiles.styles.Arrow({
            type: yfiles.styles.ArrowType.DEFAULT,
			//fill and colour the arrowhead the same colour as the edges on the page.
			//For Edges in Biarc, Deque and Rique
            fill: color,
			stroke: color
          })
		if(directed) {
			
			return new yfiles.styles.BezierEdgeStyle({
				color: color,
				stroke: stroke,
				targetArrow: targetArrowStyle
			});
		}
		return new yfiles.styles.BezierEdgeStyle({
			color: color,
			stroke: stroke
		});
	}

	// Returns edge polyline style
	function getEdgePolylineStyle(color, stroke, directed) {
        // Custom target arrow style

        const targetArrowStyle = new yfiles.styles.Arrow({
            type: yfiles.styles.ArrowType.DEFAULT,
            stroke: color,
            fill: color
          })
		if (directed){
			return new yfiles.styles.PolylineEdgeStyle({
				stroke: stroke,
//				targetArrow: yfiles.styles.IArrow.DEFAULT
                targetArrow: targetArrowStyle
			});
		}
		return new yfiles.styles.PolylineEdgeStyle({
			stroke: stroke
		});
	}

	// VOID STYLES

	// Node VOID Style
	function getNodeStyleForHiding() {
		return new yfiles.styles.VoidNodeStyle();
	}

	// Edge VOID Style
	function getEdgeStyleForHiding() {
		return new yfiles.styles.VoidEdgeStyle();
	}

	// Label VOID Style
	function getLabelStyleForHiding(){
		return new yfiles.styles.VoidLabelStyle();
	}

	/*
	----------------------------------------------------------------------------------------------
		Layout Functions
	----------------------------------------------------------------------------------------------
	*/

	function rearrangeEdgesForLinearLayout(orderedTagsOfNodes) {
		// rearranging the edges if necessary to have the arcs of the linear layout in the right orientation (swapping source and target if necessary)
		let edges = graphComponent.graph.edges.toArray();
		edges.forEach(function(e) {
			// correcting the ports if necessary
			graphComponent.graph.setPortLocation(e.sourcePort, e.sourceNode.layout.center)
			graphComponent.graph.setPortLocation(e.targetPort, e.targetNode.layout.center)
			// swapping source and target of edge in order to make them all go in the right direction if necessary
			if (orderedTagsOfNodes.indexOf(e.sourceNode.tag.toString()) > orderedTagsOfNodes.indexOf(e.targetNode.tag.toString())) {
				let newEdge = graphComponent.graph.createEdge({
					source: e.targetNode,
					target: e.sourceNode,
					tag: e.tag
				});
				// assign label of old edge to new edge
				let oldLabel = e.labels.toArray()[0].text;
				let newLabel = graphComponent.graph.addLabel(newEdge, oldLabel);
				const edgeSegmentLabelModelx = new yfiles.graph.EdgeSegmentLabelModel();
				edgeSegmentLabelModelx.offset = 10;
				edgeSegmentLabelModelx.autoRotation = false;
				graphComponent.graph.setLabelLayoutParameter(
						newLabel,
						edgeSegmentLabelModelx.createParameterFromCenter({
							sideOfEdge: "ABOVE_EDGE",
						})
				)
				// remove old edge
				graphComponent.graph.remove(e)
			}
		})
	}

     // arranges the nodes according to the calculated linear layout
	function linearNodesArrangement(orderedTagsOfNodes){
		let x = 0;
		let y = 0;
		for(let tag of orderedTagsOfNodes){
			let node = getNodeByTag(tag);
			let height = node.layout.height;
			let width = node.layout.width;
			graphComponent.graph.setNodeLayout(node, new yfiles.geometry.Rect(x, y, width, height));
			x = x + node_distance;
			nextNodex = x - 100; // needed for deque
		}
	}

	// Computes for each note in the order its predecessors
	function computePredecessors(orderedTagsOfNodes){
		let predecessor = null;
		for(let tag of orderedTagsOfNodes){
			let node = getNodeByTag(tag);
			predecessors.set(node, predecessor);
			predecessor = node;
		}
		predecessors.set(getNodeByTag(orderedTagsOfNodes[0]),getNodeByTag(orderedTagsOfNodes[orderedTagsOfNodes.length-1]))
	}

    // arranges the nodes according to the calculated circular layout
	function circularNodesArrangement(orderedTagsOfNodes){
		const totalNodes = graphComponent.graph.nodes.toArray().length;
		const x_origin = 0;
		const y_origin = 0;
		const magicNumber = 5.5;
		const r = Math.PI * totalNodes * magicNumber; // radius = 100
		const height = 30; // node
		const width = 30; // node
		let i = 0;

		// https://math.stackexchange.com/questions/1030655/how-do-we-find-points-on-a-circle-equidistant-from-each-other
		for(let tag of orderedTagsOfNodes) {
			const x = x_origin + r * (Math.cos(2 * Math.PI * i / totalNodes));
			const y = y_origin + r * (Math.sin(2 * Math.PI * i / totalNodes));
			const newLayout = new yfiles.geometry.Rect(x, y, height, width);
			graphComponent.graph.setNodeLayout(getNodeByTag(tag), newLayout);
			i += 1;
		}
	}

	function showLinearLayout(){
		if(currentLayout !== LayoutOption.LINEAR){
			previousLayout = currentLayout
			currentLayout = LayoutOption.LINEAR
		}
		if(previousLayout == LayoutOption.MATRIX){
			cleanUpMatrix();
		}
		highlightLayoutOptions(currentLayout) // blue color to selected layout option button
		// UnHide Nodes
		for(let node of graphComponent.graph.nodes.toArray()){
			setNodeStyle(node);
		}
		interpretResultAsLinearLayout(respondedObject)
		refreshStyling(treatEdgesAsDirected);
		graphComponent.fitGraphBounds();
	}

	function showCircularLayout(){

		highlightLayoutOptions(LayoutOption.CIRCULAR); // Blue color
		disableAllPagesOptions(); // disable above below
		if(currentLayout !== LayoutOption.CIRCULAR){
			previousLayout = currentLayout;
			currentLayout = LayoutOption.CIRCULAR;
		}
		if(previousLayout == LayoutOption.LINEAR){
			cleanUpEdgeArcStyleDequePage();
		}
		if(previousLayout == LayoutOption.MATRIX){
			cleanUpMatrix();
		}
		circularNodesArrangement(respondedObject.vertex_order);

        // set default style for all node since
        // when we travel from constrained layout to circular layout
        // some of the nodes might be hidden (style==>void)
        // so we need to set style back to default so that they become visible
		for(let node of graphComponent.graph.nodes.toArray()) {
			setNodeStyle(node);
		}

		// edges and nodes highlighting
		refreshStyling(treatEdgesAsDirected);

		graphComponent.fitGraphBounds();
	}

	function showConstrainedLayout(){
		highlightLayoutOptions(LayoutOption.CONSTRAINED); // blue color
		if(currentLayout !== LayoutOption.CONSTRAINED){
			previousLayout = currentLayout;
			currentLayout = LayoutOption.CONSTRAINED;
		}
		if(previousLayout == LayoutOption.LINEAR){
			cleanUpEdgeArcStyleDequePage();
		}
		if(previousLayout == LayoutOption.MATRIX){
			cleanUpMatrix();
		}
		hideEveryone();
		refreshStyling(treatEdgesAsDirected);
		graphComponent.fitGraphBounds();
	}

	const Biarc_Edge_Types = []

	function showMatrixLayout(){
		highlightLayoutOptions(LayoutOption.MATRIX);
		if(currentLayout !== LayoutOption.MATRIX){
			previousLayout = currentLayout;
			currentLayout = LayoutOption.MATRIX;
		}
		if(previousLayout == LayoutOption.LINEAR){
			cleanUpEdgeArcStyleDequePage();
		}
		disableAllPagesOptions();
		hideEveryone();
		// instead of nodes show matrix labeled with node numbers (in order)
		let space = 70;
		let num = 1;
		let node;
		let order_array = [];
		// box
		respondedObject.vertex_order.forEach(function(node_tag) {
			node = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(5, -space*num));
			let label = getNodeByTag(node_tag).labels.toArray()[0].text;
			graphComponent.graph.addLabel(node, label);
			graphComponent.graph.setStyle(node, getNodeStyle("lightgrey", getNodeDefaultShape(), getNodeDefaultStroke()))
			node.tag = "matrix";
			node = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(space*num, 5));
			graphComponent.graph.addLabel(node, label);
			graphComponent.graph.setStyle(node, getNodeStyle("lightgrey", getNodeDefaultShape(), getNodeDefaultStroke()))
			node.tag = "matrix";
			order_array.push(label);
			num = num + 1;
		})
		let edges = graphComponent.graph.edges.toArray();
		edges.forEach(function(e) {
		//console.error(e.toString())
		let Edge_As_Integer = parseInt(e.toString(), 10);
		let Temp_Edge_Position=null;
		for (let i = 0; i < Biarc_Edge_After_Rearangement.length; i++) {
			if (Biarc_Edge_After_Rearangement[i] == Edge_As_Integer) {
				Temp_Edge_Position = i;
			}
			
		}
		const  CorrectedMyResults_size= [CorrectedMyResults['Position'].length, CorrectedMyResults['Position'][0].length, CorrectedMyResults['Position'][0][0].length];
		const [m, n, p] = CorrectedMyResults_size;
		let Source_Node = null;
		let Target_Node = null;
		let Switch_Node = null;
		let Source_Found = false;
		let Target_Found = false;
		let Is_Biarc = false;
		let Temp_Position_A = null;
		let Temp_Position_B = null;
		for (let i = Temp_Edge_Position; i <Temp_Edge_Position+1; i++) {
			Source_Found = false;
			Target_Found = false;
			Is_Biarc = false;
			Temp_Position_A = null;
		    Temp_Position_B = null;
    		for (let j = 0; j < n; j++) {
        		for (let z = 0; z < p; z++) {
					//Because we don't have the list of edges in the right order, a search is performed
					//Because verteces are in the order they are represended its obvious that the first 'Up' or 'Down' after a 'N/A' is the rightmsot endpoint of the edge
					//Simillar the Last 'Up' or 'Down' before a 'N/A' is the other endpoint
					//First the source of the edge is found
            		if (CorrectedMyResults['Position'][i][j][z] !== "N/A" && Source_Found !== true) {
						Source_Node = respondedObject.vertex_order[j];
						Source_Found = true;
						Temp_Position_A = CorrectedMyResults['Position'][i][j][z];
					}
					//Then the target is found
					if (j < n-1 && Source_Found === true) {
						if (CorrectedMyResults['Position'][i][j][z] !== "N/A" && CorrectedMyResults['Position'][i][j+1][z] === "N/A" && Target_Found !== true) {
							Target_Node = respondedObject.vertex_order[j];
							Target_Found = true;
							Temp_Position_B = CorrectedMyResults['Position'][i][j][z];
						}
					}
					if (j == n-1 && Source_Found === true){
						if ((CorrectedMyResults['Position'][i][j][z] === "Up" || CorrectedMyResults['Position'][i][j][z] === "Down") && (j = n-1) && Target_Found !== true) {
							Target_Node = respondedObject.vertex_order[j];
							Target_Found = true;
							Temp_Position_B = CorrectedMyResults['Position'][i][j][z];
						}
					}
					if (j < n-1 && Source_Found === true && Target_Found !== true) {
						//If right after an 'Up' there is a 'Down' or vice versa then this edge is marked as biarc
						if (CorrectedMyResults['Position'][i][j][z] !== "N/A" && CorrectedMyResults['Position'][i][j][z] !== CorrectedMyResults['Position'][i][j+1][z] && CorrectedMyResults['Position'][i][j+1][z] !== "N/A") {
							Switch_Node = respondedObject.vertex_order[j+1];
							Is_Biarc = true;
						}
					}
					//if both endpoints are found and edge is marked as biarc
					if (Source_Found === true && Target_Found === true && Is_Biarc === true) {
						//Source might not always be the rightmost vertex, checking the distance in the layout will determine the Biarc type
						if (Temp_Position_A == "Up" && e.sourceNode.layout.x < e.targetNode.layout.x) {
							Biarc_Edge_Types[i]="UP-DOWN";
						}else if (Temp_Position_A == "Up" && e.sourceNode.layout.x > e.targetNode.layout.x){
							Biarc_Edge_Types[i]="DOWN-UP";
						}
						if (Temp_Position_A == "Down" && e.sourceNode.layout.x < e.targetNode.layout.x) {
							Biarc_Edge_Types[i]="DOWN-UP";
						}else if (Temp_Position_A == "Down" && e.sourceNode.layout.x > e.targetNode.layout.x){
							Biarc_Edge_Types[i]="UP-DOWN";
						}
						break;
	
					}
					//if the edge is not marked as biarc then its drawn as stack edge
					if (Source_Found === true && Target_Found === true && Is_Biarc === false) {
						if (Temp_Position_A === "Up") {
							Biarc_Edge_Types[i]="ArcAbove";
						}
						if (Temp_Position_A === "Down") {
							Biarc_Edge_Types[i]="ArcBelow";
						}
						break;
					}
        		}
    		}
		}
		
		})
		
		// edges (represented as nodes)
		for(let pageNumber=1; pageNumber <= pagesArray.length; pageNumber++){
			var color = colorsOfPages[pageNumber - 1];
			var placing = $("#placingPage" + pageNumber).val().slice(0,5);
			for(let edge of pagesArray[pageNumber - 1]){
				for(let edgeNumber=1; edgeNumber <= order_array.length; edgeNumber++) {
					if (edge.sourceNode.labels.toArray()[0].text == order_array[edgeNumber - 1]) {
						var x = edgeNumber*space;
					} else if (edge.targetNode.labels.toArray()[0].text == order_array[edgeNumber - 1]) {
						var y = -edgeNumber*space;
					}
				}
				var type = getDequeType(edge);
				node = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(x, y));
				graphComponent.graph.addLabel(node, edge.labels.toArray()[0].text);
				node.tag = "matrix";
				if (getDequeType(edge) === "HEAD") {
					graphComponent.graph.setStyle(node, getNodeStyle(color, "triangle", getNodeDefaultStroke()))
				} else if (getDequeType(edge) === "TAIL") {
					graphComponent.graph.setStyle(node, getNodeStyle(color, "triangle2", getNodeDefaultStroke()))
				} else if (getDequeType(edge) === "QUEUE_H_T") {
					const style1 = new yfiles.styles.RectangleNodeStyle({
						shape: 'diamond',
						cornerSize: 1,
						scaleCornerSize: true,
						cornerStyle: 'round',
						corners: ['top-left', 'bottom-right'],
						fill: color,
						 stroke: 'White'
					})
					graphComponent.graph.setStyle(node, style1)
				} else if (getDequeType(edge) === "QUEUE_T_H") {
					const style2 = new yfiles.styles.RectangleNodeStyle({
						shape: 'diamond',
						cornerSize: 1,
						scaleCornerSize: true,
						cornerStyle: 'round',
						corners: ['top-right', 'bottom-left'],
						fill: color,
						 stroke: 'White'
					})
					graphComponent.graph.setStyle(node, style2)
				} else if (Biarc_Edge_Types[0] != null) {
					let Edge_As_Integer = parseInt(edge.toString(), 10);
					let Temp_Edge_Position=null;
					for (let i = 0; i < Biarc_Edge_After_Rearangement.length; i++) {
						if (Biarc_Edge_After_Rearangement[i] == Edge_As_Integer) {
							Temp_Edge_Position = i;
						}
						
						if (Biarc_Edge_Types[Temp_Edge_Position] == "ArcAbove") {
							graphComponent.graph.setStyle(node, getNodeStyle(color, "triangle", getNodeDefaultStroke()))
						}
						if (Biarc_Edge_Types[Temp_Edge_Position] == "ArcBelow") {
							graphComponent.graph.setStyle(node, getNodeStyle(color, "triangle2", getNodeDefaultStroke()))
						}
						if (Biarc_Edge_Types[Temp_Edge_Position] == "UP-DOWN") {
							const style1 = new yfiles.styles.RectangleNodeStyle({
								shape: 'diamond',
								cornerSize: 1,
    							scaleCornerSize: true,
    							cornerStyle: 'round',
    							corners: ['top-left', 'bottom-right'],
    							fill: color,
 							    stroke: 'White'
							})
							graphComponent.graph.setStyle(node, style1)
						}
						if (Biarc_Edge_Types[Temp_Edge_Position] == "DOWN-UP") {
							const style2 = new yfiles.styles.RectangleNodeStyle({
								shape: 'diamond',
								cornerSize: 1,
    							scaleCornerSize: true,
    							cornerStyle: 'round',
    							corners: ['top-right', 'bottom-left'],
    							fill: color,
 							    stroke: 'White'
							})
							graphComponent.graph.setStyle(node, style2)
						}
			
					}
			 	} else {
					graphComponent.graph.setStyle(node, getNodeStyle(color, getNodeDefaultShape(), getNodeDefaultStroke()))
				}
			}
		}
		graphComponent.zoomTo(new yfiles.geometry.Rect(0, -respondedObject.vertex_order.length*space-10, respondedObject.vertex_order.length*space, respondedObject.vertex_order.length*space));
	}

	function cleanUpMatrix() {
		graphComponent.graph.nodes.toArray().forEach(function(node) {
			if (node.tag === "matrix") {
				graphComponent.graph.remove(node);
			}
		})
	}

	/*
	----------------------------------------------------------------------------------------------
		Standard Functions
	----------------------------------------------------------------------------------------------
	*/

	function displayStats(){
		let graph = graphComponent.graph;
		const adapter = new yfiles.layout.YGraphAdapter(graphComponent.graph)
		let ygraph = adapter.yGraph;
		let nrOfVertices = graph.nodes.size;
		let nrOfEdges = graph.edges.size;
		let isPlanar = yfiles.algorithms.PlanarEmbedding.isPlanar(ygraph);
		var faceSizes = "";
			if (isPlanar) {
				var planarEmbedding = new yfiles.algorithms.PlanarEmbedding(ygraph);
				var arrayOfFaces = planarEmbedding.faces.toArray();	//An array of the faces of the graph.
				for (i=3; i<=20; i++) {
					var longFaces = arrayOfFaces.filter(face => face.size == i);
					if (longFaces.length > 0)
						faceSizes += i + "(" + longFaces.length + ") ";
				}
			}
			else {
				faceSizes = "-";
			}
		let isConnected = yfiles.algorithms.GraphChecker.isConnected(ygraph);
		let cyclePath = yfiles.algorithms.Cycles.findCycle(ygraph, treatEdgesAsDirected);
		let isAcyclic = cyclePath.size === 0;

		let isTree = yfiles.algorithms.Trees.isTree(ygraph);
		let isBipartite = yfiles.algorithms.GraphChecker.isBipartite(ygraph);

		var maxdegree = 0
		var maxdegree = 0
		var mindegree = nrOfVertices
		for (const v of ygraph.nodes) {				
			if (v.edges.size > maxdegree) {
				maxdegree = v.edges.size;
			}				
			if (v.edges.size < mindegree) {
				mindegree = v.edges.size;
			}
		}
		//console.log(maxdegree)

		var is2Connected = true;
		const bc = new yfiles.analysis.BiconnectedComponents();
		const result = bc.run(graph);
		if (result.components.size != 1) {
			is2Connected = false;
		}

		var is3Connected = true;
		if (nrOfVertices < 4) {
			is3Connected = false;
		} else {
			for (const node of graph.nodes) {
				const bc = new yfiles.analysis.BiconnectedComponents();
				bc.subgraphNodes.excludes = node;
				const result = bc.run(graph);
				if (result.components.size != 1) {
					is3Connected = false;
					break;
				}
			}
		}

		document.getElementById("nrOfVertices").innerHTML =  nrOfVertices;
		document.getElementById("nrOfEdges").innerHTML = nrOfEdges;
		document.getElementById("isPlanar").innerHTML = isPlanar;
		if (isPlanar) {document.getElementById("isPlanar").style.color = "green"} else {document.getElementById("isPlanar").style.color = "red"}
		document.getElementById("faceSizes").innerHTML = faceSizes;
		document.getElementById("isConnected").innerHTML = isConnected;
		if (isConnected) {document.getElementById("isConnected").style.color = "green"} else {document.getElementById("isConnected").style.color = "red"}
		document.getElementById("is2Connected").innerHTML = is2Connected;
		if (is2Connected) {document.getElementById("is2Connected").style.color = "green"} else {document.getElementById("is2Connected").style.color = "red"}
		document.getElementById("is3Connected").innerHTML = is3Connected;
		if (is3Connected) {document.getElementById("is3Connected").style.color = "green"} else {document.getElementById("is3Connected").style.color = "red"}
		document.getElementById("isAcyclic").innerHTML = isAcyclic;
		if (isAcyclic) {document.getElementById("isAcyclic").style.color = "green"} else {document.getElementById("isAcyclic").style.color = "red"}
		document.getElementById("isTree").innerHTML = isTree;
		if (isTree) {document.getElementById("isTree").style.color = "green"} else {document.getElementById("isTree").style.color = "red"}
		document.getElementById("isBipartite").innerHTML = isBipartite;
		if (isBipartite) {document.getElementById("isBipartite").style.color = "green"} else {document.getElementById("isBipartite").style.color = "red"}
		
		document.getElementById("maxDegree").innerHTML = maxdegree;
		document.getElementById("minDegree").innerHTML = mindegree;

		if(treatEdgesAsDirected){
			document.getElementById("reducedTr").style.display = "table-row";
			document.getElementById("reducedTr").style.verticalAlign = "top";
			try {
				const resultTransitiveReduction = new yfiles.analysis.TransitiveReduction().run(graphComponent.graph);
				if(resultTransitiveReduction.edgesToRemove.size > 0) {
					// reducible
					var isReduced = false;
					document.getElementById("isReduced").style.color = "red";
					var isReducedOutputStr = isReduced + "<br><br>";
					for (const edge of resultTransitiveReduction.edgesToRemove) {
						  isReducedOutputStr = isReducedOutputStr + "Edge("+ edge.sourceNode +" ,"+ edge.targetNode +") is transitive<br>"
					}
					document.getElementById("isReduced").innerHTML = isReducedOutputStr;
				}
				else {
					// not reducible
					var isReduced = true;
					document.getElementById("isReduced").style.color = "green";
					document.getElementById("isReduced").innerHTML = isReduced;
				}
			}
			catch(error) {
				 // not reducible
				var isReduced = true;
				document.getElementById("isReduced").style.color = "green";
				document.getElementById("isReduced").innerHTML = isReduced;
			}
		}
		else {
			document.getElementById("reducedTr").style.display = "none";
		}
	}

	function interpretResult(object) {
		var graph = object.graph;
		graph = atob(graph);

		// LOADING IN THE GRAPH
		graphMLIOHandler
		.readFromGraphMLText(graphComponent.graph, graph)
		.then(() => {
			graphComponent.fitGraphBounds();
		});
		
		linearNodesArrangement(object.vertex_order);
		computePredecessors(object.vertex_order);
		rearrangeEdgesForLinearLayout(object.vertex_order);
		registerEdgesInPagesArray(object.assignments); // REGISTERING WHICH EDGES GO TO WHICH PAGES
		registerEdgesDequeType(object.deq_edge_type);
		registerBiarcsEdgePositions(object.Top, object.Bottom);
		registerListOfBiarcPages(object.List_of_Biarc_Pages)

		// LabelPlacing
		const edgeSegmentLabelModel = new yfiles.graph.EdgeSegmentLabelModel()

		var edgeLabels = graphComponent.graph.edgeLabels.toArray();
		edgeLabels.forEach(function(el) {
			graphComponent.graph.setLabelLayoutParameter(
					el,
					edgeSegmentLabelModel.createParameterFromCenter({
						sideOfEdge: "ABOVE_EDGE",
					})
			)
		})

		// Since edges can be re-created above we need to reload the constraints and selected constraints and highlight edges
		// interpret constraints
		loadConstraintsFromJSON(object.constraints);
		updateSelectedConstraints();
		let pageNumber;
		for(pageNumber=1; pageNumber <= pagesArray.length; pageNumber++) {
			updateEdgesOfPageAndPageOptions(pageNumber, treatEdgesAsDirected);
		}

		originalNodeWidth = graphComponent.graph.nodes.toArray()[0].layout.width
		originalNodeHeight = graphComponent.graph.nodes.toArray()[0].layout.height
	}

	function interpretResultAsLinearLayout(object) {
		linearNodesArrangement(object.vertex_order);
		computePredecessors(object.vertex_order);
		rearrangeEdgesForLinearLayout(object.vertex_order);
		registerEdgesInPagesArray(object.assignments);
		registerEdgesDequeType(object.deq_edge_type);
		registerBiarcsEdgePositions(object.Top, object.Bottom);
		// Since edges can be re-created above we need to reload the constraints and selected constraints and highlight edges
		// interpret constraints
		loadConstraintsFromJSON(object.constraints);
		updateSelectedConstraints();
		let pageNumber;
		for(pageNumber=1; pageNumber <= pagesArray.length; pageNumber++) {
			updateEdgesOfPageAndPageOptions(pageNumber, treatEdgesAsDirected);
		}
		updatePagesWithConstraints(object.pages);
		graphComponent.fitGraphBounds();
	}

	function initializeGrid() {
		// Holds Info about the grid (such as spacing)
		gridInfo = new yfiles.view.GridInfo();
		gridInfo.horizontalSpacing = 40;
		gridInfo.verticalSpacing = 40;
		//add grid
		grid = new yfiles.view.GridVisualCreator(gridInfo);
		grid.gridStyle = yfiles.view.GridStyle.DOTS;
		graphComponent.backgroundGroup.addChild(grid);
	}

	function saveFile(filename) {
		if (filename == "") {
			filename = "unnamed";
		}
		graphMLIOHandler
		.write(graphComponent.graph)
		.then(result => myGraph=result);

		setTimeout(function(){
			myGraph = myGraph.slice(0,-10);
			myGraph = myGraph + "\t<pages>";
			let pages = respondedObject.pages;
			pages.forEach(function(p) {
				myGraph = myGraph + "\r\n\t\t<page>";
				myGraph = myGraph + "\r\n\t\t\t<id>" + p.id + "</id>";
				myGraph = myGraph + "\r\n\t\t\t<type>" + p.type + "</type>";
				myGraph = myGraph + "\r\n\t\t\t<layout>" + p.constraint + "</layout>";
				myGraph = myGraph + "\r\n\t\t</page>";
			});
			myGraph = myGraph  + "\r\n\t</pages>\r\n\t<constraints>\r\n";
			constraintsArray.forEach(function(c) {
				myGraph = myGraph  + c.serialize() + "\r\n";
			})
			myGraph = myGraph + "\t</constraints>\r\n</graphml>";
			FileSaveSupport.save(myGraph, filename+".graphml");
		}, 1);
	}

	function showNeighborhood() {
		graphComponent.inputMode.addItemClickedListener( function(sender, args)  {
			if (yfiles.graph.INode.isInstance(args.item)) {
				let node = args.item;
				$("#nodeNeighborhoodDescription").empty();
				$("#nodeNeighborhood").dialog({ title: "Neighborhood of vertex " + node.toString() });

				let neighborhood = [[], [], [], []];

				let incidentEdges = graphComponent.graph.edgesAt(node);
				for (let e of incidentEdges) {
					let targetNode = e.targetNode;
					let sourceNode = e.sourceNode;
					var pageOfEdge = getPageIndex(e) + 1;
					if (targetNode !== node) {
						neighborhood[pageOfEdge - 1].push(targetNode)
					}
					else if (sourceNode !== node) {
						neighborhood[pageOfEdge - 1].push(sourceNode)
					}
				}

				let i;
				for (i = 1; i<=numberOfPages; i++) {
					if (neighborhood[i-1].length !== 0) {
						var color = colorsOfPages[i-1];
						$("#nodeNeighborhoodDescription").prepend("<br><div style='color: "+ color + "'><b>"+neighborhood[i-1].toString() + "</b></div>")
					}
				}
			}
			else if (yfiles.graph.IEdge.isInstance(args.item)) {
				var edge = args.item
				$("#edgeNeighborhood").dialog({ title: "Adjacency of edge (" +edge.sourceNode + "," + edge.targetNode + ")"});
				var pageOfEdge = getPageIndex(edge) + 1;
				var color = colorsOfPages[pageOfEdge - 1];
				$("#edgeNeighborhoodDescription").empty();
				$("#edgeNeighborhoodDescription").prepend("<div style='color: "+ color + "'><b>Source node: "+ edge.sourceNode + "<br> Target node: "+ edge.targetNode +"</b></div>");
			}
		})

	}

	function initializeExample() {
		const node1 = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(0,0))
		const node2 = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(200,0))
		const node3 = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(400,0))
		const node4 = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(600,0))

		graphComponent.graph.addLabel(node1, "1");
		graphComponent.graph.addLabel(node2, "2");
		graphComponent.graph.addLabel(node3, "3");
		graphComponent.graph.addLabel(node4, "4");

		const edge1 = graphComponent.graph.createEdge(node1, node2)
		graphComponent.graph.addLabel(edge1, "1")
		const edge2 = graphComponent.graph.createEdge(node2, node3)
		graphComponent.graph.addLabel(edge2, "2")
		const edge3 = graphComponent.graph.createEdge(node1, node3)
		graphComponent.graph.addLabel(edge3, "3")
		const edge4 = graphComponent.graph.createEdge(node2, node4)
		graphComponent.graph.addLabel(edge3, "3")


		graphComponent.fitGraphBounds();

		pagesArray = [[edge1, edge2, edge3], [edge4]]

	}

	function run() {

		highlightLayoutOptions(currentLayout); // Highlights current layout button LINEAR, CIRCULAR, CONSTRAINED, MATRIX

		graphComponent = new yfiles.view.GraphComponent("#graphComponent");
		graphComponent.inputMode = new yfiles.input.GraphViewerInputMode({
			clickableItems:  yfiles.graph.GraphItemTypes.NODE | yfiles.graph.GraphItemTypes.EDGE,
			selectableItems: yfiles.graph.GraphItemTypes.NODE | yfiles.graph.GraphItemTypes.EDGE
		})

		showNeighborhood();

		/* zooming only when ctrl is held*/
		graphComponent.mouseWheelBehavior = yfiles.view.MouseWheelBehaviors.ZOOM | yfiles.view.MouseWheelBehaviors.SCROLL;

		graphMLIOHandler = new yfiles.graphml.GraphMLIOHandler();

		const support = new yfiles.graphml.GraphMLSupport({
			graphComponent: graphComponent,
			storageLocation: yfiles.graphml.StorageLocation.FILE_SYSTEM,
			graphMLIOHandler: graphMLIOHandler
		});

		if (currentLayout === LayoutOption.LINEAR) {
			enableAllPagesOptions(); // Enable All Pages options "Above or Below"
		}

		graphComponent.graph.nodeDefaults.style = getNodeDefaultStyle();
		chosenPages = respondedObject.pages.length;

		let i;
		for (i = 1; i<= chosenPages; i++) {
			if (i % 2 !== 0) {
				//console.error(respondedObject.List_of_Biarc_Pages[i])
				if (respondedObject.List_of_Biarc_Pages[i-1] == true){
					$("#display").append(
							"<div class='displayingSettings'>"+
							"<label for='displayPage"+i+"'>Page "+i+"</label><input id='displayPage"+i+"' type='checkbox' checked>"+
							"<select id='placingPage"+i+"'>"+
							"<option value='abovePage"+i+"'>above</option>"+
							"<option value='belowPage"+i+"'>below</option>"+
							"<option value='dequePage"+i+"'>deque</option>"+
							"<option value='biarcPage"+i+"'>biarc</option>"+
							"</select>"+
							"<div class='picker' id='picker"+i+"'></div>" +
							"</div>"

					);
				} else {
					$("#display").append(
						"<div class='displayingSettings'>"+
						"<label for='displayPage"+i+"'>Page "+i+"</label><input id='displayPage"+i+"' type='checkbox' checked>"+
						"<select id='placingPage"+i+"'>"+
						"<option value='abovePage"+i+"'>above</option>"+
						"<option value='belowPage"+i+"'>below</option>"+
						"<option value='dequePage"+i+"'>deque</option>"+
						"<option value='biarcPage"+i+"'>biarc</option>"+
						"</select>"+
						"<div class='picker' id='picker"+i+"'></div>" +
						"</div>"

				);
				}
			} else {
				if (respondedObject.List_of_Biarc_Pages[i-1] == true){
					$("#display").append(
							"<div class='displayingSettings'>"+
							"<label for='displayPage"+i+"'>Page "+i+"</label><input id='displayPage"+i+"' type='checkbox' checked>"+
							"<select id='placingPage"+i+"'>"+
							"<option value='abovePage"+i+"'>above</option>"+
							"<option value='belowPage"+i+"' selected='selected'>below</option>"+
							"<option value='dequePage"+i+"'>deque</option>"+
							"<option value='biarcPage"+i+"'>biarc</option>"+
							"</select>"+
							"<div class='picker' id='picker"+i+"'></div>" +
							"</div>"
					);
				} else {
					$("#display").append(
						"<div class='displayingSettings'>"+
						"<label for='displayPage"+i+"'>Page "+i+"</label><input id='displayPage"+i+"' type='checkbox' checked>"+
						"<select id='placingPage"+i+"'>"+
						"<option value='abovePage"+i+"'>above</option>"+
						"<option value='belowPage"+i+"' selected='selected'>below</option>"+
						"<option value='dequePage"+i+"'>deque</option>"+
						"<option value='biarcPage"+i+"'>biarc</option>"+
						"</select>"+
						"<div class='picker' id='picker"+i+"'></div>" +
						"</div>"
				);
				}
			}

			$("#displayPage" + i).checkboxradio();
			$("#placingPage"+ i).selectmenu({
				position: { my : "top left", at: "top center" }
			});
			$("#colorPage"+i).selectmenu({
				position: { my : "top left", at: "top center" }
			});

			$("#displayPage"+i).checkboxradio("option", "width", 150);
			$("#displayPage"+i).on("change", function(event, data) {
				/*
					LOGIC
					if page == checked:
						if currentLayout == LINEAR:
							enabled Above/Below options
							Show all the edges on this page as ARC edges
							Highlight all the edges of the constraints that are a part of this page
						elif currentLayout == CIRCULAR:
							Show all the edges on this page as Poly edges
							Highlight all the edges of the constraints that are a part of this page
						elif currentLayout == CONSTRAINED:
							if previousLayout == LINEAR:
								Show only those edges of the constraints that are a part of this page
								Highlight all the edges of the constraints that are a part of this page
							elif previousLayout == CIRCULAR:
								Show only those edges of the constraints that are a part of this page
								Highlight all the edges of the constraints that are a part of this page
					else:
						Disable page options
						Hide all the edges that are a part of this page
				*/

				let pageNumber = this.id.slice(-1);
				updateEdgesOfPageAndPageOptions(pageNumber, treatEdgesAsDirected);
				graphComponent.fitGraphBounds();
			});

			$("#placingPage" + i).selectmenu("option", "width", "120px");
			$( "#placingPage" + i ).selectmenu({
				change: function( event, data ) {

				    // data.item.value ==> "belowPage12" [for page 12]
				    // data.item.value ==> "abovePage12" [for page 12]
				    // data.item.value ==> "dequePage12" [for page 12]

				    let pageNumber = parseInt(data.item.value.slice(9)); // since length of abovePage and belowPage ==> 9
//					let pageNumber = parseInt(data.item.value.slice(-1));
					updateEdgesOfPageAndPageOptions(pageNumber, treatEdgesAsDirected);
					graphComponent.fitGraphBounds();
			    }
			});
			$("#picker"+i).colorPick({
				'id': i,
				'paletteLabel': 'Palette',
				'allowRecent': false,
				'initialColor' : getDefaultColor(i),
				//'palette': ["#8A2BE2","#FF007F", "#FF0000", "#FF8300", "#FFFF00",  "#00FF00", "#15E2CB", "#0000FF", "#7E7E7E", "#000000"],
				'palette': colors,
				'onColorSelected': function() {
					updateColorArray(this.id, this.color);
					let pageNumber = this.id;
					updateEdgesOfPageAndPageOptions(pageNumber, treatEdgesAsDirected);
					this.element.css({'backgroundColor': this.color, 'color': this.color});
				}
			});
		}

		// Set the label model for edges
		graphComponent.graph.edgeDefaults.labels.layoutParameter = new yfiles.graph.SmartEdgeLabelModel({
			autoRotation: true
		}).createParameterFromSource(0, 10.0, 0.5);

		interpretResult(respondedObject);
		initializeGrid();
	}

	/**
	* Sends Request to API
	*
	* Calls run() on successful response
	*
	*/
	function sendRequest(link) {
		let status;
		$.ajax({
			url: link + "?async=true",
			success: function(response) {
				status = response.status;
				if (status === "FINISHED") {
					$("#loadingDiv").hide();
					$("#ProgressDialog").dialog("close");
					if (! response.satisfiable) {
						$("#ProgressDialog").dialog("close");
						$("#notSatisfiableNrPages").append(response.pages.length);
						$("#notSatisfiableDialog").dialog("open");
					}
					else {
						respondedObject = response;
						if (respondedObject.pages.length != numberOfPages) {
							window.localStorage.setItem("numberOfPages", respondedObject.pages.length)
							numberOfPages = parseInt(window.localStorage.getItem("numberOfPages"));
							dynamicPagesArray();
						}
						run();
					}

				}
				else if (status === "IN_PROGRESS"){
					setTimeout(function() {
						sendRequest(link);
					}, 5000);
				}
				else if (status === "FAILED" || status === "CANCELLED") {
					$("#ProgressDialog").dialog("close");
					$("#errorMessage").append(response.message);
					$("#failedComputationDialog").dialog("open");
				}
			},
			error: function() {
				$("#errorDialog").dialog("open");
			},
		})
	}

	/**
	* Register commands and listeners
	*
	*/
	function registerCommands(){

		/*
		 * progress dialog
		 */

		document.querySelector("#cancelComputation").addEventListener("click", () => {
			$.ajax({
				url: link,
				method: "DELETE",
				success: function() {
				//  $("#infoMessage").append("The task has been cancelled but the corresponding process may still run until the administrator terminates it.");
				//	$("#cancelledNotificationDialog").dialog("open");
				    localStorage.setItem("showCancelNotice", "true");
					location.href = "index.html#or" + location.hash.slice(1);
				},
				error: function() {
					alert("Something went wrong");
				}
			});
		});

		/*
		 * File tab
		 */

		// FILE SAVE & EXPORT

		document.querySelector("#SaveDialogButton").addEventListener("click", () => {
			$("#saveDialog").dialog("open");
		});

		document.querySelector("#saveButton").addEventListener("click", () => {
			saveFile($("#fileName").val());
			$("#saveDialog").dialog("close");
		});

		document.querySelector("#cancelSaveDialog").addEventListener("click", () => {
			$("#saveDialog").dialog("close");
		});

		document.querySelector("#ExportButton").addEventListener("click", () => {
			$("#exportDialog").dialog("open");
		});

		/*
		 * Layout tab
		 */

		// Linear Layout Button Click
		document.querySelector("#lineLayoutButton").addEventListener("click", () => {
			showLinearLayout();
		});

		// Circular Layout Button Click
		document.querySelector("#circLayoutButton").addEventListener("click", () => {
			showCircularLayout();
		});

		// Constrained Layout Button Click
		document.querySelector("#consLayoutButton").addEventListener("click", () => {
			showConstrainedLayout();
		});

		// Matrix Layout Button Click
		document.querySelector("#matrixLayoutButton").addEventListener("click", () => {
			showMatrixLayout();
		});


		/*
		 * view tab
		 */

		document.querySelector("#ZoomInButton").addEventListener("click", () => {
			yfiles.input.ICommand.INCREASE_ZOOM.execute({target: graphComponent});
		});

		document.querySelector("#ZoomOutButton").addEventListener("click", () => {
			yfiles.input.ICommand.DECREASE_ZOOM.execute({target: graphComponent});
		});

		document.querySelector("#FitButton").addEventListener("click", () => {
			yfiles.input.ICommand.FIT_GRAPH_BOUNDS.execute({target: graphComponent});
		});

		document.querySelector('#GridButton').addEventListener("click", () => {
			grid.visible = !grid.visible;
			graphComponent.invalidate();
		});

		document.querySelector("#backButton").addEventListener("click", () => {
			$("#EditDialog").dialog("open");
		});

		document.querySelector("#editBookEmbedding").addEventListener("click", () => {
			location.href = "index.html#ll" + location.hash.slice(1);
		});

		document.querySelector("#editOriginalLayout").addEventListener("click", () => {
			location.href = "index.html#or" + location.hash.slice(1);
		});

		document.querySelector("#yesBackToEdit").addEventListener("click", () => {
			location.href = "index.html#or" + location.hash.slice(1);
		});

		document.querySelector("#yesBackToEdit2").addEventListener("click", () => {
			location.href = "index.html#or" + location.hash.slice(1);
		});

		document.querySelector("#yesBackToEdit3").addEventListener("click", () => {
			location.href = "index.html#or" + location.hash.slice(1);
		});


		/*
		 * Export Dialog
		 */

		document.querySelector("#ExportAsPdf").addEventListener("click", () => {
			clientSidePdfExport = new ShowClientSidePdfExport();

			const scale = parseFloat(1);
			const margin = parseFloat(5);

			clientSidePdfExport.scale = scale;
			clientSidePdfExport.margins = new yfiles.geometry.Insets(margin);

			clientSidePdfExport.exportPdf(graphComponent.graph, null). then(pdfUrl => {
				pdfUrl = pdfUrl
				FileSaveSupport.save(pdfUrl, 'graph.pdf')
			}).catch(() => {
				alert(
						'Saving directly to the filesystem is not supported by this browser. Make sure to save your graph as .graphml and try with another browser'
				)
			})
			$("#exportDialog").dialog("close");
		});

		document.querySelector("#ExportAsImage").addEventListener("click", () => {
			const scale = parseFloat(1);
			const margin = parseFloat(5);

			clientSideImageExport = new ShowClientSideImageExport();

			clientSideImageExport.scale = scale;
			clientSideImageExport.margins = new yfiles.geometry.Insets(margin);

			clientSideImageExport
			.exportImage(graphComponent.graph, null)
			.then(pngImage => {
				FileSaveSupport.save(pngImage.src, 'graph.png')
			}).catch(() => {
				alert(
						'Saving directly to the filesystem is not supported by this browser. Make sure to save your graph as .graphml and try with another browser'
				)
			})
			$("#exportDialog").dialog("close");
		});

		/**
		 * Stats Button
		 */

		$("#statsButton").click(function() {
			displayStats();
			$("#statsDialog").dialog("open");
		});

		/* Constraint Tag Listener */

		// Adding a listener: onTagClicked for constraints

		$("#constraintTags").tagit({
			onTagClicked: function(event, ui) {
				let constraintIndex = ui.tag.index();  // Index of the tag on the UI
				let constraint = constraintsArray[constraintIndex]; // Global Constraints Array [get object]
				/*
					selectedConstraints ==> dictionary [key, value] pair
					key ==> constraint's index
					value ==> constraint object
					Purpose ==> To keep track of currently selected constraints on the UI
				*/

				// CONSTRAINT WAS ALREADY CLICKED
				if (constraintIndex in selectedConstraints) {
					// remove constraint's highlighting
					removeHighlightConstraintTagUsingIndex(constraintIndex);
					if (currentLayout === LayoutOption.CONSTRAINED){
						hideEveryone();
					}

					// remove highlighting of nodes and edges of given constraint
					// ^^^ Handled in refresh styling

					// remove constraint from selectedConstraints
					delete selectedConstraints[constraintIndex];
				}
				// FIRST TIME CLICKED ON CONSTRAINT
				else {
					if (currentLayout === LayoutOption.CONSTRAINED){
						hideEveryone(); // Hide unwanted nodes and edges and highlight on selected constraints nodes and edges
					}
					// Highlight constraint tag on UI
					highlightConstraintTagUsingIndex(constraintIndex); // give box border color to selected constraint on the UI
					// add constraint in selectedConstraints for keeping track which one is selected
					selectedConstraints[constraintIndex] = constraint;
					// highlight nodes / edges of given constraint
					// ^^^ handled in refreshStyling()
				}
				// For multiple constraints - Overlapping of same nodes/edges situation is handled here
				refreshStyling(treatEdgesAsDirected);
				graphComponent.fitGraphBounds();
			}
		});
	}

	/**
	* Main Function
	*
	* Registers commands and calls API
	*
	*/
	function request() {
		registerCommands();

		let embeddingID = location.hash;
		if (embeddingID === "") {
			$("#ProgressDialog").dialog("close");
			$("#noIDDialog").dialog("open");
		}
		else {
			embeddingID = embeddingID.slice(1);
			let currentServer = window.localStorage.getItem("currentServer");
			if (currentServer == null) {
				document.getElementById("displayCurrentServer").innerHTML = standardServer;
				link = "http://alice.cs.uni-tuebingen.de:5555/embeddings/" + embeddingID;
			}
			else {
				document.getElementById("displayCurrentServer").innerHTML = currentServer;
				link = currentServer + "/embeddings/" + embeddingID;
			}
			sendRequest(link);
		}
	}

	//--------------------------------------------------------------------------------------------
	request() // main call
})