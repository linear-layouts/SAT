'use strict'

require.config({
	paths: {
		yfiles: 'javascript/yFiles/lib/umd/',
		utils: 'javascript/yFiles/demos/utils/',
		resources: 'javascript/yFiles/demos/resources/'
	}
})

require([

	'yfiles/view-editor',
	'utils/ContextMenu',
	'utils/FileSaveSupport',
	'yfiles/complete',
	//'yfiles/view',
	'./js/ClientSideImageExport.js',
	'./js/ClientSidePdfExport.js',
	'yfiles/view-layout-bridge',
	'resources/license'
], (/** @type {yfiles_namespace} */ /** typeof yfiles */ yfiles,
	ContextMenu,
	FileSaveSupport,
	PositionHandler,
	ClientSideImageExport,
	ClientSidePdfExport
) => {


	/* some global variables */
	let graphComponent = new yfiles.view.GraphComponent("#graphComponent");

	let graphMLIOHandler = null;

	let graph = null;

	var standardServer = "http://alice.informatik.uni-tuebingen.de:5555/embeddings"
	//var standardServer = "http://0.0.0.0:5555/embeddings"

	var numberOfPages = parseInt(window.localStorage.getItem("numberOfPages"));

	let gridInfo = null;
	let grid = null;

	//        var offsetClipboardNode = null;
	var numberOfCopiedNodes = 0;
	var numberOfCopiedEdges = 0;

	var lqnBool = true;
	var nodesStableSize = true;
	var allowDoubleEdges = false;
	var treatEdgesAsDirected = false;
	var removedTagManually = false;
	var constraintsArrayOfClipboard = [];
	var nodesIndexPositionInClipboardUsingTag = {};
	var edgesIndexPositionInClipboardUsingTag = {};
	let myGraph;

	let clientSidePdfExport = null;
	let clientSideImageExport = null;
	var totalNumberOfNodesDuringCopy = 0
	var totalNumberOfEdgesDuringCopy = 0
	//		var pagesArray = [[],[],[],[]]
	/*var pagesArray = [
			[], //1
			[], //2
			[], //3
			[], //4
			[], //5
			[], //6
			[], //7
			[], //8
			[], //9
			[] //10
	];*/

	var pagesArray = new Array(numberOfPages);

	for (var i = 0; i < pagesArray.length; i++) {
		pagesArray[i] = [];
	}


	let analyzer = null;

	var initialColors = ["#FF0000", "#0000FF", "#00FF00", "#7E7E7E", "#8A2BE2", "#FFFF00", "#15E2CB", "#FF007F", "#FF8300", "#000000"];
	var colors = new Array(numberOfPages)
	for (var i = 0; i < colors.length; i++) {
		if (i <= initialColors.length) { colors[i] = initialColors[i] }
		else {
			colors[i] = "#000000"
		}
	}
	/*
					function getColor(i)
					{
							if (i>10) {
									return "#000000"
							}
							else {
									return colors[i]
							}*/
	//     }

	/* Main Function */

	function run() {
		graphComponent.inputMode = new yfiles.input.GraphEditorInputMode()
		const createEdgeInputMode = graphComponent.inputMode.createEdgeInputMode


		var showCancelNotice = localStorage.getItem("showCancelNotice");
		if (showCancelNotice === "true") {
			// # open dialog
			localStorage.setItem("showCancelNotice", "false");
			console.log("Hopeful!")
			$("#infoMessage").append("The task has been cancelled but the corresponding process may still run until the administrator terminates it.");
			$("#cancelledNotificationDialog").dialog("open");
		}

		/* zooming only when ctrl is held*/
		graphComponent.mouseWheelBehavior =
			yfiles.view.MouseWheelBehaviors.ZOOM | yfiles.view.MouseWheelBehaviors.SCROLL;

		/* resizing of nodes not allowed by default, changeable by resizableNode checkbox in tools section*/
		graphComponent.inputMode.showHandleItems =
			yfiles.graph.GraphItemTypes.ALL & ~yfiles.graph.GraphItemTypes.NODE;

		/* UNDO REDO ALLOWED */
		graphComponent.graph.undoEngineEnabled = true;

		/* labels can't be selected */
		graphComponent.inputMode.clickableItems = yfiles.graph.GraphItemTypes.NODE | yfiles.graph.GraphItemTypes.EDGE


		graphMLIOHandler = new yfiles.graphml.GraphMLIOHandler();

		const support = new yfiles.graphml.GraphMLSupport({
			graphComponent: graphComponent,
			graphMLIOHandler: graphMLIOHandler
		});






		/*
		 * WHEN A NODE/EDGE IS CREATED LISTENER
		 */

		graphComponent.inputMode.addNodeCreatedListener((sender, args) => {
			let node = args.item;

			// if no label is set, create new label
			if (node.labels.size == 0) {
				let label = getNextLabel("node")
				graphComponent.graph.addLabel(node, label.toString())
			}

			// if no tag is set, set new tag
			if (node.tag == null) {
				node.tag = getNextTag()

			}

		})

		// TODO change tag here DONE

		createEdgeInputMode.addEdgeCreatedListener((sender, args) => {
			let edge = args.item

			edge.tag = edge.sourceNode.tag + "-(0)-" + edge.targetNode.tag

			if (edge.labels.size == 0) {
				let label = getNextLabel("edge");
				var newLabel = graphComponent.graph.addLabel(edge, label.toString())


				// for each edge assign edge label style (label above edge)

				const edgeSegmentLabelModel = new yfiles.graph.EdgeSegmentLabelModel()
				edgeSegmentLabelModel.offset = 7
				edgeSegmentLabelModel.autoRotation = false;
				graphComponent.graph.setLabelLayoutParameter(
					newLabel,
					edgeSegmentLabelModel.createParameterFromCenter({
						sideOfEdge: "ABOVE_EDGE",
					})
				)

				// forbid double edges
				var edges = graphComponent.graph.edges.toArray();

				// abort when double edges are not allowed
				if (!allowDoubleEdges) {
					edges.forEach(function (e) {
						if (((edge.sourceNode == e.sourceNode && edge.targetNode == e.targetNode) || (edge.sourceNode == e.targetNode && edge.targetNode == e.sourceNode)) && edge != e) {
							setTimeout(function () {
								if (graphComponent.graph.contains(edge)) {
									graphComponent.graph.remove(edge);
								}
								else {

								}
							}, 10)
						}
					})
				} else {
					// double Edges are allowed
					// what to do with tags??
				}

			}
		})


		/*
		 * NODE COPY LISTENER
		 */

		graphComponent.clipboard.fromClipboardCopier.addNodeCopiedListener((sender, args) => {
			args.copy.tag = getNextTag()
		})


		/*
		 * EDGE COPY LISTENER
		 * TODO change tag here DONE
		 */

		graphComponent.clipboard.fromClipboardCopier.addEdgeCopiedListener((sender, args) => {
			var edge = args.copy
			var edges = graphComponent.graph.edges.toArray();

			if (!allowDoubleEdges) {
				edges.forEach(function (e) {
					if (((edge.sourceNode == e.sourceNode && edge.targetNode == e.targetNode) || (edge.sourceNode == e.targetNode && edge.targetNode == e.sourceNode)) && edge != e) {
						setTimeout(function () {
							if (graphComponent.graph.contains(edge)) {
								graphComponent.graph.remove(edge);
							}
						}, 10)
					}
				})
			} else {
				var occurrance = 0;
				edges.forEach(function (e) {
					if (edge.sourceNode == e.sourceNode && edge.targetNode == e.targetNode) {
						occurrance = occurrance + 1;
					}
				})
				edge.tag = edge.sourceNode + "-(" + occurrance + ")-" + edge.targetNode
			}
		})



		/*
		 *
		 * WHEN A LABEL IS CHANGED THE CONSTRAINT GETS CHANGED TO
		 *
		 */

		graphComponent.inputMode.addLabelTextChangedListener((sender, args) => {
			// iterate over all connected constraints and update these tags
			var constraintsArrayIndexes = findRelatedConstraintsDeluxeByIndex(args.item.owner)
			let constrIndex;
			constraintsArrayIndexes.forEach(function (ci) {
				constraintsArray[ci].updatePrintable()
				var liTagChildren = $("#constraintTags").tagit("instance").tagList.children("li").toArray()[ci].children
				let childrenIndex
				for (childrenIndex = 0; childrenIndex < liTagChildren.length; childrenIndex++) {
					if (liTagChildren[childrenIndex].tagName == "SPAN") {
						liTagChildren[childrenIndex].textContent = constraintsArray[ci].getPrintable()
					}
				}
			})
		})

		//displaying current server
		var currentServer = window.localStorage.getItem("currentServer")
		if (currentServer == null) {
			currentServer = standardServer
		}
		document.getElementById("displayCurrentServer").innerHTML = currentServer;

		initializeGraphDefaults();
		initializeSnapping();
		initializeGrid();
		configureContextMenu(graphComponent);

		configureDeletion();
		registerCommands();

		// check if there is a hash location, if yes display graph with #id
		if (location.hash != "") {

			var embeddingID = location.hash.slice(3)
			let link;

			// checking if there is a preferred server in the local storage, if not use the standard server
			var currentServer = window.localStorage.getItem("currentServer")
			if (currentServer == null) {
				//document.getElementById("displayCurrentServer").innerHTML = "http://sofa.fsi.uni-tuebingen.de:5555/embeddings/"
				link = standardServer + "/" + embeddingID
			} else {
				//document.getElementById("displayCurrentServer").innerHTML = currentServer
				link = currentServer + "/embeddings/" + embeddingID
			}


			let object;

			// ajax request for this embedding
			$.ajax({
				url: link,
				success:
					function (response) {
						object = response;
					},
				error: function () {
					alert("error")
					//$("#errorDialog").dialog("open")
				},
				complete: function () {
					var graph = object.graph
					graph = atob(graph)


					// read graph
					graphMLIOHandler
						.readFromGraphMLText(graphComponent.graph, graph)
						.then(() => {
							// transform graph according to embedding
							if (location.hash.slice(0, 3) == "#ll") {
								// display linear layout
								interpretResultAsLinearLayout(object)
							} else if (location.hash.slice(0, 3) == "#or") {
								// display original embedding
								interpretResultAsRegularLayout(object)
							}

						})
				}
			})


		}
	}

	function setDifference(setA, setB) {
		let _difference = new Set(setA)
		for (let elem of setB) {
			_difference.delete(elem)
		}
		return _difference
	}

	function removeEdgeFromArray(e, edges) {
		let i
		var newEdges = []
		for (i = 0; i < edges.length; i++) {
			if (edges[i].tag != e.tag) {
				newEdges.push(edges[i])
			}
		}
		return newEdges
	}

	// Get edges from clipboard (when they are copied)
	function getClipboardEdges() {
		var clipboardNodes = graphComponent.selection.selectedNodes.toArray()
		var clipboardEdges = []
		var edges = graphComponent.graph.edges.toArray()
		var tempEdgesSelected = graphComponent.selection.selectedEdges.toArray()
		edges.forEach(function (e) {
			if (clipboardNodes.includes(e.sourceNode) && clipboardNodes.includes(e.targetNode)) {
				clipboardEdges.push(e)
				tempEdgesSelected = removeEdgeFromArray(e, tempEdgesSelected)
			}
		})
		return clipboardEdges.concat(tempEdgesSelected)
	}

	// Copy all the constraints in constraintsArrayOfClipboard
	function copyOfConstraintsInClipboard() {
		constraintsArrayOfClipboard = []
		numberOfCopiedNodes = 0
		numberOfCopiedEdges = 0
		totalNumberOfNodesDuringCopy = 0
		totalNumberOfEdgesDuringCopy = 0
		var clipboardNodes = graphComponent.selection.selectedNodes.toArray()
		numberOfCopiedNodes = clipboardNodes.length
		var clipboardNodesTagsSet = new Set()
		var i = 0
		var sortedClipboardNodesTags = []

		clipboardNodes.forEach(function (n) {
			clipboardNodesTagsSet.add(n.tag);
			sortedClipboardNodesTags.push(n.tag);
		}
		)
		sortedClipboardNodesTags.sort()
		sortedClipboardNodesTags.forEach(function (t) {
			nodesIndexPositionInClipboardUsingTag[t] = i
			i = i + 1
		})


		var clipboardEdges = getClipboardEdges()
		numberOfCopiedEdges = clipboardEdges.length
		var clipboardEdgesTagsSet = new Set()
		var j = 0
		clipboardEdges.forEach(function (e) {
			clipboardEdgesTagsSet.add(e.tag);
			edgesIndexPositionInClipboardUsingTag[e.tag] = j;
			j = j + 1
		})

		constraintsArray.forEach(function (c) {
			if (["NODES_SET_FIRST", "NODES_SET_LAST", "NODES_PREDECESSOR", "NODES_CONSECUTIVE",
				"NODES_REQUIRE_PARTIAL_ORDER", "NODES_FORBID_PARTIAL_ORDER", "EDGES_SAME_PAGES_INCIDENT_NODE",
				"EDGES_DIFFERENT_PAGES_INCIDENT_NODE"].includes(c.type)) {
				var constraintsNodesTagsSet = new Set();
				c.objects.forEach(function (n) {
					constraintsNodesTagsSet.add(n.tag)
				})

				var setResult = setDifference(constraintsNodesTagsSet, clipboardNodesTagsSet)
				if (setResult.size == 0) {
					constraintsArrayOfClipboard.push(c)
				}
			}
			else if (["EDGES_FROM_NODES_ON_PAGES", "EDGES_TO_SUB_ARC_ON_PAGES", "EDGES_ON_PAGES_INCIDENT_NODE"].includes(c.type)) {
				var constraintsNodesTagsSet = new Set();
				c.objects[0].forEach(function (n) {
					constraintsNodesTagsSet.add(n.tag)
				})

				var setResult = setDifference(constraintsNodesTagsSet, clipboardNodesTagsSet)
				if (setResult.size == 0) {
					constraintsArrayOfClipboard.push(c)
				}
			}
			else if (["EDGES_SAME_PAGES", "EDGES_DIFFERENT_PAGES", "NOT_ALL_IN_SAME_PAGE"].includes(c.type)) {
				var constraintsEdgesTagsSet = new Set();
				c.objects.forEach(function (e) {
					constraintsEdgesTagsSet.add(e.tag)
				})

				var setResult = setDifference(constraintsEdgesTagsSet, clipboardEdgesTagsSet)
				if (setResult.size == 0) {
					constraintsArrayOfClipboard.push(c)
				}
			}
			else if (["EDGES_ON_PAGES"].includes(c.type)) {
				var constraintsEdgesTagsSet = new Set();
				c.objects[0].forEach(function (e) {
					constraintsEdgesTagsSet.add(e.tag)
				})

				var setResult = setDifference(constraintsEdgesTagsSet, clipboardEdgesTagsSet)
				if (setResult.size == 0) {
					constraintsArrayOfClipboard.push(c)
				}
			}
		})
	}

	// Get pasted nodes and edges  by index
	function getPastedNodeUsingBaseIndex(nodeBase, tag, nodes) {
		var pastedNodeIndex = nodeBase + nodesIndexPositionInClipboardUsingTag[tag]
		var pastedConstraintNode = nodes[pastedNodeIndex]
		return pastedConstraintNode
	}

	function getPastedEdgeUsingBaseIndex(edgeBase, tag, edges) {
		var pastedEdgeIndex = edgeBase + edgesIndexPositionInClipboardUsingTag[tag]
		var pastedConstraintEdge = edges[pastedEdgeIndex]
		return pastedConstraintEdge
	}

	function isConstraintRelatedToNodes(constraintEnum) {
		var constraintsEnumRelatedToNodes = ["EDGES_ON_PAGES_INCIDENT_NODE", "EDGES_DIFFERENT_PAGES_INCIDENT_NODE",
			"EDGES_SAME_PAGES_INCIDENT_NODE",
			"EDGES_TO_SUB_ARC_ON_PAGES", "EDGES_FROM_NODES_ON_PAGES",
			"NODES_FORBID_PARTIAL_ORDER", "NODES_CONSECUTIVE",
			"NODES_REQUIRE_PARTIAL_ORDER", "NODES_SET_FIRST", "NODES_SET_LAST", "NODES_PREDECESSOR"]
		if (constraintsEnumRelatedToNodes.includes(constraintEnum)) {
			return true
		}
		return false
	}

	function makeConstraintUsingEnum(constraintEnum, constraintArguments) {
		var constraint = null
		switch (constraintEnum) {
			case "NODES_SET_FIRST": constraint = new SetAsFirst(constraintArguments)
				break;
			case "NODES_SET_LAST": constraint = new SetAsLast(constraintArguments)
				break;
			case "NODES_PREDECESSOR": constraint = new Predecessor(constraintArguments)
				break;
			case "NODES_CONSECUTIVE": constraint = new Consecutive(constraintArguments)
				break;
			case "NODES_REQUIRE_PARTIAL_ORDER": constraint = new RequirePartialOrder(constraintArguments)
				break;
			case "NODES_FORBID_PARTIAL_ORDER": constraint = new ForbidPartialOrder(constraintArguments)
				break;
			case "EDGES_FROM_NODES_ON_PAGES": constraint = new RestrictEdgesFrom(constraintArguments)
				break;
			case "EDGES_TO_SUB_ARC_ON_PAGES": constraint = new RestrictEdgesToArc(constraintArguments)
				break;
			case "EDGES_ON_PAGES": constraint = new AssignedTo(constraintArguments)
				break;
			case "EDGES_SAME_PAGES": constraint = new SamePage(constraintArguments)
				break;
			case "EDGES_DIFFERENT_PAGES": constraint = new DifferentPages(constraintArguments)
				break;
			case "NOT_ALL_IN_SAME_PAGE": constraint = new NotAllInSamePage(constraintArguments)
				break;
			case "EDGES_SAME_PAGES_INCIDENT_NODE": constraint = new SamePageForIncidentEdgesOf(constraintArguments)
				break;
			case "EDGES_DIFFERENT_PAGES_INCIDENT_NODE": constraint = new DifferentPagesForIncidentEdgesOf(constraintArguments)
				break;
			case "EDGES_ON_PAGES_INCIDENT_NODE": constraint = new IncidentEdgesOfVertexTo(constraintArguments)
				break;
		}
		if (constraint != null) {
			constraintsArray.push(constraint)
			$("#constraintTags").tagit("createTag", constraint.getPrintable())
		}
	}

	function computationAfterPaste() {
		console.log("Computation After Paste Started");

		// Edge Corrections
		var edges = graphComponent.graph.edges.toArray();
		edges.forEach(function (e) {
			e.tag = e.sourceNode.tag + "-(0)-" + e.targetNode.tag
		}
		)

		// All the nodes in the graph currently
		var nodes = graphComponent.graph.nodes.toArray()
		var totalNumberOfNodesAfterPaste = nodes.length // total number of nodes after paste
		// Calculate base index from where new nodes are numbered after paste
		var base = totalNumberOfNodesAfterPaste - numberOfCopiedNodes

		// All the edges in the graph currently
		var edges = graphComponent.graph.edges.toArray()
		var totalNumberOfEdgesAfterPaste = edges.length // total number of edges after paste
		// Calculate base index from where new edges are numbered after paste
		var edgeBase = totalNumberOfEdgesAfterPaste - numberOfCopiedEdges

		constraintsArrayOfClipboard.forEach(function (c) {
			var tempArray = []
			var args = []
			switch (c.type) {
				case "NODES_SET_FIRST":
				case "NODES_SET_LAST":
				case "EDGES_SAME_PAGES_INCIDENT_NODE":
				case "EDGES_DIFFERENT_PAGES_INCIDENT_NODE":
				case "NODES_PREDECESSOR":
				case "NODES_CONSECUTIVE":
				case "NODES_REQUIRE_PARTIAL_ORDER":
				case "NODES_FORBID_PARTIAL_ORDER":
				case "EDGES_SAME_PAGES":
				case "EDGES_DIFFERENT_PAGES":
				case "NOT_ALL_IN_SAME_PAGE":
					c.objects.forEach(function (n) {
						if (isConstraintRelatedToNodes(c.type)) {
							tempArray.push(getPastedNodeUsingBaseIndex(base, n.tag, nodes))
						}
						else {
							tempArray.push(getPastedEdgeUsingBaseIndex(edgeBase, e.tag, edges))
						}
					})
					makeConstraintUsingEnum(c.type, tempArray)
					break;
				case "EDGES_FROM_NODES_ON_PAGES":
				case "EDGES_TO_SUB_ARC_ON_PAGES":
				case "EDGES_ON_PAGES":
				case "EDGES_ON_PAGES_INCIDENT_NODE":
					c.objects[0].forEach(function (n) {
						if (isConstraintRelatedToNodes(c.type)) {
							tempArray.push(getPastedNodeUsingBaseIndex(base, n.tag, nodes))
						}
						else {
							tempArray.push(getPastedEdgeUsingBaseIndex(edgeBase, e.tag, edges))
						}
					})
					args = [tempArray, c.objects[1]]
					makeConstraintUsingEnum(c.type, args)
					break;
			}
		}
		)
	}

	/*
	 * creates new labels for nodes or edges
	 */

	function getNextLabel(item) {
		if (item == "node") {
			var max = -1;
			graphComponent.graph.nodes.forEach(function (n) {
				var x = parseInt(n.toString());
				if (x > max) {
					max = x;
				}
			})

			return max + 1;
		} else if (item == "edge") {
			var max = -1;
			graphComponent.graph.edges.forEach(function (e) {
				var x = parseInt(e.toString());
				if (x > max) {
					max = x;
				}
			})

			return max + 1;
		}
	}

	/*
	 * creates tags for nodes
	 */

	function getNextTag() {
		var max = -1;
		graphComponent.graph.nodes.forEach(function (n) {
			if (parseInt(n.tag) > max) {
				max = parseInt(n.tag)
			}
		})
		return max + 1;
	}

	/*
	 *
	 * this function configures the standard deletion to first check if any constraints are affected and if there are, rechecks if deletion is desired
	 *
	 */

	function configureDeletion() {

		// change command binding of deleting to first showing
		graphComponent.inputMode.keyboardInputMode.addCommandBinding(
			yfiles.input.ICommand.DELETE,
			() => {

				// collect all items that should be deleted, collect all adjacent edges that get deleted too
				const selection = graphComponent.selection
				var adjEdges = [];

				var delNodes = selection.selectedNodes.toArray();
				delNodes.forEach(function (node) {
					var arr = graphComponent.graph.edgesAt(node).toArray();
					arr.forEach(function (edge) {
						adjEdges.push(edge)
					})
				})


				// all items that get deleted
				var selItems = selection.toArray();
				selItems = selItems.concat(adjEdges);


				// search for related constraints
				var relConstraints = []

				selItems.forEach(function (i) {
					relConstraints = relConstraints.concat(findRelatedConstraintsDeluxe(i))
				})

				// if related constraints exist, show dialog
				if (relConstraints.length > 0) {
					$("#deleteDialog").dialog("open");
				} else {
					graphComponent.inputMode.deleteSelection();
				}

			})

	}

	/*
	 *
	 * changes which elements should be selected by marquee selection
	 *
	 */

	function changeSelectionMode(marqueeSelected) {
		if (marqueeSelected == "all") {
			graphComponent.inputMode.marqueeSelectableItems = yfiles.graph.GraphItemTypes.ALL
		} else if (marqueeSelected == "nodes") {
			graphComponent.inputMode.marqueeSelectableItems = yfiles.graph.GraphItemTypes.NODE

		} else {
			graphComponent.inputMode.marqueeSelectableItems = yfiles.graph.GraphItemTypes.EDGE
		}

	}

	/*
	 *
	 *  configuring the context menu
	 *
	 */

	function configureContextMenu(graphComponent) {
		const inputMode = graphComponent.inputMode
		const contextMenu = new ContextMenu(graphComponent)



		contextMenu.addOpeningEventListeners(graphComponent, location => {
			if (inputMode.contextMenuInputMode.shouldOpenMenu(graphComponent.toWorldFromPage(location))) {
				contextMenu.show(location)
			}
		})


		inputMode.addPopulateItemContextMenuListener((sender, args) =>
			populateContextMenu(contextMenu, graphComponent, args)
		)


		inputMode.contextMenuInputMode.addCloseMenuListener(() => {
			$("#pageDialog").empty()
			contextMenu.close()
		})
		contextMenu.onClosedCallback = () => {
			inputMode.contextMenuInputMode.menuClosed()
		}
	}

	/*
	 * adds menu items to the context menu
	 */

	function populateContextMenu(contextMenu, graphComponent, args) {
		args.showMenu = true

		contextMenu.clearItems()

		var avPages = [1];

		if (graphComponent.selection.selectedNodes.size > 0 && graphComponent.selection.selectedEdges.size > 0) {
			// do nothing
		} else if (graphComponent.selection.selectedEdges.size == 1) {
			selEdges = graphComponent.selection.selectedEdges.toArray();
			contextMenu.addMenuItem('Assign to...', () => $("#pageDialog").dialog("open"), fillAssignDialog());

			//contextMenu.addMenuItem("tag", () => alert(selEdges[0].tag))
		} else if (graphComponent.selection.selectedNodes.size == 1) {
			//contextMenu.addMenuItem("tag", () => alert(graphComponent.selection.selectedNodes.toArray()[0].tag))

			contextMenu.addMenuItem('Set as first in the order', () => {

				let constr = new SetAsFirst(graphComponent.selection.selectedNodes.toArray());
				constraintsArray.push(constr)
				$("#constraintTags").tagit("createTag", constr.getPrintable())
			});
			contextMenu.addMenuItem('Set as last in the order', () => {

				let constr = new SetAsLast(graphComponent.selection.selectedNodes.toArray());
				constraintsArray.push(constr)
				$("#constraintTags").tagit("createTag", constr.getPrintable())
			});

			contextMenu.addMenuItem('Assign all edges incident to this vertex to the same page', () => {
				let constr = new SamePageForIncidentEdgesOf(graphComponent.selection.selectedNodes.toArray());
				constraintsArray.push(constr)
				$("#constraintTags").tagit("createTag", constr.getPrintable())
			});

			contextMenu.addMenuItem('Assign all edges incident to this vertex to different pages', () => {
				let constr = new DifferentPagesForIncidentEdgesOf(graphComponent.selection.selectedNodes.toArray());
				constraintsArray.push(constr)
				$("#constraintTags").tagit("createTag", constr.getPrintable())
			});
			contextMenu.addMenuItem('Assign all edges incident to this vertex to...', () => $("#pageDialog").dialog("open"), fillAssignDialogForNodes(graphComponent));


		} else if (graphComponent.selection.selectedNodes.size == 2) {
			var nodesArr = graphComponent.selection.selectedNodes.toArray();
			var a = nodesArr[0];
			var b = nodesArr[1];
			contextMenu.addMenuItem('Make ' + a + ' predecessor to ' + b, () => {
				let constr = new Predecessor(nodesArr);
				constraintsArray.push(constr)
				$("#constraintTags").tagit("createTag", constr.getPrintable())
			}),


				contextMenu.addMenuItem('Make ' + b + ' predecessor to ' + a, () => {
					let constr = new Predecessor(nodesArr.reverse());
					constraintsArray.push(constr)
					$("#constraintTags").tagit("createTag", constr.getPrintable())
				}),


				contextMenu.addMenuItem('Make consecutive', () => {

					let constr = new Consecutive(nodesArr);
					constraintsArray.push(constr)
					$("#constraintTags").tagit("createTag", constr.getPrintable())
				});

			contextMenu.addMenuItem('Partial order', () => {
				fillOrderDialog();
			})
			contextMenu.addMenuItem('Restrict the edges from ' + a + ' and ' + b, () => {
				fillRestrictDialog([a, b])
			})

		} else if (graphComponent.selection.selectedNodes.size >= 2) {
			var nodesArr = graphComponent.selection.selectedNodes.toArray();
			contextMenu.addMenuItem('Partial order', () => {
				fillOrderDialog();
			})
			contextMenu.addMenuItem('Restrict the edges from ' + nodesArr.toString(), () => {
				fillRestrictDialog(nodesArr)
			})
		} else if (graphComponent.selection.selectedEdges.size > 1) {
			selEdges = graphComponent.selection.selectedEdges.toArray();
			contextMenu.addMenuItem('Assign to...', () => $("#pageDialog").dialog("open"), fillAssignDialog());
			contextMenu.addMenuItem('Assign to the same page', () => {
				var arr = []


				selEdges.forEach(function (a) {
					arr.push(a.toString())
				})
				let constr = new SamePage(selEdges);

				constraintsArray.push(constr)

				$("#constraintTags").tagit("createTag", constr.getPrintable())
			})

			var avPages = [1];

			let k;
			for (k = 2; k <= numberOfPages; k++) {
				if ($("#page" + k).prop("checked")) {
					avPages.push(k);
				}
			}

			if (graphComponent.selection.selectedEdges.size <= avPages.length) {
				contextMenu.addMenuItem('Assign to pairwise different pages', () => {

					var arr = []


					selEdges.forEach(function (a) {
						arr.push(a.toString())
					})

					let constr = new DifferentPages(selEdges);
					constraintsArray.push(constr)
					$("#constraintTags").tagit("createTag", constr.getPrintable())
				});
			}

			if (graphComponent.selection.selectedEdges.size >= 2 && avPages.length > 1) {
				contextMenu.addMenuItem('Not all at the same page', () => {

					var arr = []


					selEdges.forEach(function (a) {
						arr.push(a.toString())
					})

					let constr = new NotAllInSamePage(selEdges);
					constraintsArray.push(constr)
					$("#constraintTags").tagit("createTag", constr.getPrintable())
				});
			}
		}
	}

	/*
	 * For the constraint "restrict edges of..." this function populates the dialog that shows up
	 */

	function fillRestrictDialog(arr) {
		if (arr.length == 2) {
			var a = arr[0]
			var b = arr[1]
			$("#restrictEdgesDialog").append("<div><label class='restrictLabel2' for='allEdges'>All edges incident to " + a + " and " + b + "</label><input name='restrictEdges' type='radio' id='allEdges'>" +
				"<br><label class='restrictLabel2' for='edgesInAB'>Only those in the interval between " + a + " and " + b + "</label><input name='restrictEdges' type='radio' id='edgesInAB'>" +
				"<br><label class='restrictLabel2' for='edgesInBA'>Only those outside the interval between " + a + " and " + b + "</label><input name='restrictEdges' type='radio' id='edgesInBA'></div>")

			$("#allEdges").checkboxradio()
			$("#edgesInAB").checkboxradio()
			$("#edgesInBA").checkboxradio()

			$("#restrictEdgesDialog").append("<br><br>")

			var pages = getAvailablePages()
			pages.forEach(function (p) {
				$("#restrictEdgesDialog").append("<label class='restrictLabel1' for='restrictPage" + p.toString() + "'>Page " + p.toString() + "</label><input type='checkbox' id='restrictPage" + p.toString() + "'>")
				$("#restrictPage" + p.toString()).checkboxradio({
				})

			})

			$("#restrictEdgesDialog").append("<br><br><button id='applyRestriction' class='ui-button ui-widget ui-corner-all'>Apply restriction</button>" +
				"<button id='cancelRestriction' class='ui-button ui-widget ui-corner-all'>Cancel</button>")


			$("#cancelRestriction").click(function () {
				$("#restrictEdgesDialog").dialog("close")
			})

			$("#applyRestriction").click(function () {
				var checkedPages = []
				let i;
				for (i = 1; i <= numberOfPages; i++) {
					if ($("#restrictPage" + i).prop("checked")) {
						checkedPages.push("P" + i)
					}
				}
				if (checkedPages.length > 0) {
					if ($("#allEdges").prop("checked")) {
						var con = new RestrictEdgesFrom([[a, b], checkedPages])
						constraintsArray.push(con)
						$("#constraintTags").tagit("createTag", con.getPrintable())
					} else if ($("#edgesInAB").prop("checked")) {
						var con = new RestrictEdgesToArc([[a, b], checkedPages])
						constraintsArray.push(con)
						$("#constraintTags").tagit("createTag", con.getPrintable())
					} else if ($("#edgesInBA").prop("checked")) {
						var con = new RestrictEdgesToArc([[b, a], checkedPages])
						constraintsArray.push(con)
						$("#constraintTags").tagit("createTag", con.getPrintable())

					}
				}

				$("#restrictEdgesDialog").dialog("close")
			})
		} else {

			$("#restrictEdgesDialog").append("<div style='font-size: 20px'>All edges incident to " + arr.toString() + " will be assigned to</div>")

			$("#restrictEdgesDialog").append("<br><br>")
			var pages = getAvailablePages()
			pages.forEach(function (p) {
				$("#restrictEdgesDialog").append("<label class='restrictLabel1' for='restrictPage" + p.toString() + "'>Page " + p.toString() + "</label><input type='checkbox' id='restrictPage" + p.toString() + "'>")
				$("#restrictPage" + p.toString()).checkboxradio({
				})

			})

			$("#restrictEdgesDialog").append("<br><br><button id='applyRestriction' class='ui-button ui-widget ui-corner-all'>Apply restriction</button>" +
				"<button id='cancelRestriction' class='ui-button ui-widget ui-corner-all'>Cancel</button>")


			$("#cancelRestriction").click(function () {
				$("#restrictEdgesDialog").dialog("close")
			})

			$("#applyRestriction").click(function () {
				var checkedPages = []
				let i;
				for (i = 1; i <= numberOfPages; i++) {
					if ($("#restrictPage" + i).prop("checked")) {
						checkedPages.push("P" + i)
					}
				}

				var con = new RestrictEdgesFrom([arr, checkedPages])
				constraintsArray.push(con)
				$("#constraintTags").tagit("createTag", con.getPrintable())
				$("#restrictEdgesDialog").dialog("close")
			})

		}
		$("#restrictEdgesDialog").dialog("open")

	}

	/*
	 *  For the partial order constraint this function fills the dialog that shows up
	 */

	function fillOrderDialog() {
		let miniGraphComponent = new yfiles.view.GraphComponent("#miniGraphComponent");
		miniGraphComponent.inputMode = new yfiles.input.GraphViewerInputMode()

		$("#orderingDialog").dialog({
			width: 600,
			resizable: false,
			autoOpen: false,
			beforeClose: function (event, ui) {
				miniGraphComponent.graph.clear()
			}
		})

		miniGraphComponent.graph.nodeDefaults.style = new yfiles.styles.ShapeNodeStyle({
			fill: '#FFA500',
			shape: 'ellipse',
			stroke: 'white',
		})

		var selNodes = graphComponent.selection.selectedNodes.toArray()
		var position = 0

		selNodes.forEach(function (n) {
			var newNode = miniGraphComponent.graph.createNodeAt(new yfiles.geometry.Point(position, 0))
			miniGraphComponent.graph.addLabel(newNode, n.labels.toArray()[0].text)
			position = position + 50
		})


		miniGraphComponent.fitGraphBounds()


		$("#orderingDialog").dialog("open")



	}

	/*
	 * this initializes the grid snapping
	 */

	function initializeSnapping() {
		const graphSnapContext = new yfiles.input.GraphSnapContext({
			enabled: true,
			snapBendAdjacentSegments: false,
			snapBendsToSnapLines: false,
			snapNodesToSnapLines: false,
			snapOrthogonalMovement: false,
			snapPortAdjacentSegments: false,
			snapSegmentsToSnapLines: false
		})
		graphSnapContext.gridSnapType = yfiles.input.GridSnapTypes.ALL;
		graphComponent.inputMode.snapContext = graphSnapContext
	}

	/*
	 * this initializes the grid
	 */

	function initializeGrid() {
		// Holds Info about the grid (such as spacing)
		gridInfo = new yfiles.view.GridInfo()

		gridInfo.horizontalSpacing = 40
		gridInfo.verticalSpacing = 40


		//add grid
		grid = new yfiles.view.GridVisualCreator(gridInfo)
		grid.gridStyle = yfiles.view.GridStyle.DOTS

		graphComponent.backgroundGroup.addChild(grid)

		const graphSnapContext = graphComponent.inputMode.snapContext
		graphSnapContext.nodeGridConstraintProvider = new yfiles.input.GridConstraintProvider(gridInfo)
		graphSnapContext.bendGridConstraintProvider = new yfiles.input.GridConstraintProvider(gridInfo)
	}

	// TODO change this to less
	function updateSnapType(snaptype) {
		const graphSnapContext = graphComponent.inputMode.snapContext
		if (snaptype == 'none') {
			graphSnapContext.gridSnapType = yfiles.input.GridSnapTypes.NONE
		}
		else if (snaptype == 'lines') {
			graphSnapContext.gridSnapType = yfiles.input.GridSnapTypes.LINES
		}
		else if (snaptype == 'points') {
			graphSnapContext.gridSnapType = yfiles.input.GridSnapTypes.GRID_POINTS
		}
		else {
			graphSnapContext.gridSnapType = yfiles.input.GridSnapTypes.ALL
		}

		graphComponent.invalidate()

	}

	/*
	 * this sets the defaults for nodes and edges
	 */

	function initializeGraphDefaults() {
		const graph = graphComponent.graph;

		/*
		 * node style
		 */

		graph.nodeDefaults.style = new yfiles.styles.ShapeNodeStyle({
			fill: '#FFA500',
			shape: 'ellipse',
			stroke: 'white',
		})

		/*
		 * edge style
		 */

		graph.edgeDefaults.style = new yfiles.styles.PolylineEdgeStyle({
			targetArrow: yfiles.styles.IArrow.NONE
		})

	}

	/*
	 * checks how many pages are available for the lin layout
	 */

	function getAvailablePages() {
		var avPages = [1];

		let k;
		for (k = 2; k <= numberOfPages; k++) {
			if ($("#page" + k).prop("checked")) {
				avPages.push(k);
			}
		}
		return avPages;

	}

	/*
	 * deserializes the constraints
	 */

	function deserialize(string) {
		var type = filterStringByTag(string, "type");
		type = type[0];
		var objects = filterStringByTag(string, "objects")[0];

		switch (type) {
			case "NODES_PREDECESSOR":
				var objString = objects.split(",")
				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})

				var con = new Predecessor(objItems)
				constraintsArray.push(con);

				break;
			case "TREAT_GRAPH_DIRECTED":
				objString = objects;
				var objString = objects.split(",")
				var objItems = ["1"];
				var con = new TreatGraphDirected(objItems)
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "NODES_CONSECUTIVE":
				var objString = objects.split(",")

				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})

				var con = new Consecutive(objItems)
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "NODES_SET_FIRST":
				var objString = objects.split(",")

				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})

				var con = new SetAsFirst(objItems)
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "EDGES_SAME_PAGES_INCIDENT_NODE":
				var objString = objects.split(",")

				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})

				var con = new SamePageForIncidentEdgesOf(objItems)
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "EDGES_DIFFERENT_PAGES_INCIDENT_NODE":
				var objString = objects.split(",")

				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})

				var con = new DifferentPagesForIncidentEdgesOf(objItems)
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "NODES_SET_LAST":

				var objString = objects.split(",")

				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})

				var con = new SetAsLast(objItems)
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "EDGES_SAME_PAGES":
				objString = objects;
				var objString = objects.split(",")
				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "edge"))
				})

				var con = new SamePage(objItems)
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "EDGES_DIFFERENT_PAGES":
				var objString = objects.split(",")
				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "edge"))
				})


				var con = new DifferentPages(objItems)
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "NOT_ALL_IN_SAME_PAGE":
				var objString = objects.split(",")
				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "edge"))
				})


				var con = new NotAllInSamePage(objItems)
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "EDGES_ON_PAGES":
				var objString = filterStringByTag(objects, "objectsA")[0]
				objString = objString.split(",")
				var pages = filterStringByTag(objects, "objectsB")[0]
				pages = pages.split(",")

				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "edge"))
				})

				var con = new AssignedTo([objItems, pages])
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "NODES_REQUIRE_PARTIAL_ORDER":
				var objString = objects.split(",")
				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})
				var con = new RequirePartialOrder(objItems)
				constraintsArray.push(con)
				$("#constraintTags").tagit("createTag", con.getPrintable())
				
				break;
			case "NODES_FORBID_PARTIAL_ORDER":

				var objString = objects.split(",")
				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})

				var con = new ForbidPartialOrder(objItems)
				constraintsArray.push(con)
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "EDGES_FROM_NODES_ON_PAGES":
				var objString = filterStringByTag(objects, "objectsA")[0]
				objString = objString.split(",")
				var pages = filterStringByTag(objects, "objectsB")[0]
				pages = pages.split(",")

				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})

				var con = new RestrictEdgesFrom([objItems, pages])
				constraintsArray.push(con)
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "EDGES_ON_PAGES_INCIDENT_NODE":
				var objString = filterStringByTag(objects, "objectsA")[0]
				objString = objString.split(",")
				var pages = filterStringByTag(objects, "objectsB")[0]
				pages = pages.split(",")

				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})

				var con = new IncidentEdgesOfVertexTo([objItems, pages])
				constraintsArray.push(con)
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
			case "EDGES_TO_SUB_ARC_ON_PAGES":
				var objString = filterStringByTag(objects, "objectsA")[0]
				objString = objString.split(",")
				var pages = filterStringByTag(objects, "objectsB")[0]
				pages = pages.split(",")

				var objItems = [];

				objString.forEach(function (os) {
					objItems = objItems.concat(findObjectByTag(os, "node"))
				})


				var con = new RestrictEdgesFrom([objItems, pages])
				constraintsArray.push(con)
				$("#constraintTags").tagit("createTag", con.getPrintable())

				break;
		}
	}

	function findObjectByTag(tag, type) {
		var toSearchIn;

		if (type == "node") {
			toSearchIn = graphComponent.graph.nodes.toArray();
		} else if (type == "edge") {
			toSearchIn = graphComponent.graph.edges.toArray();
		}

		var y = null;

		toSearchIn.forEach(function (i) {
			if (i.tag == tag) {
				y = i;
			}
		})
		return y;

	}

	/*
	 * PARSES THE FILE YOU LOAD IN
	 */

	function readFile(e) {
		var file = e.target.files[0];
		if (!file) {
			return;
		}
		var reader = new FileReader();
		//	var senddata = new Object();
		reader.onload = function (e) {
			//		senddata.
			myGraph = e.target.result;

			// reset all settings:

			deleteAllConstraints();
			disableFollowingPages(2);

			var constraints = filterStringByTag(myGraph, "constraint")
			var pages = filterStringByTag(myGraph, "page")

			if (pages.length == 0) {
				var pages2 = filterStringByTag(myGraph, "pages")
				let i;
				for (i = 1; i <= parseInt(pages2[0]); i++) {
					$("#page" + i).prop("checked", true);
					$("#page" + i).button("refresh");

					$("#page" + i).checkboxradio({
						disabled: false
					})
					$("#typeP" + i).selectmenu({
						disabled: false
					})
					$("#layoutP" + i).selectmenu({
						disabled: false
					})
					$("#page" + (i + 1)).checkboxradio({
						disabled: false
					})
					$("#page" + (i + 1)).button("refresh")

				}

			} else {

				// load in pages
				pages.forEach(function (page) {
					var id = filterStringByTag(page, "id")[0]
					id = id.slice(1)
					var type = filterStringByTag(page, "type")
					var layout = filterStringByTag(page, "layout")

					$("#page" + id).prop("checked", true);
					$("#page" + id).button("refresh");

					$("#page" + id).checkboxradio({
						disabled: false
					})

					$("#typeP" + id).selectmenu({
						disabled: false
					})

					$("#typeP" + id).val(type)
					$("#typeP" + id).selectmenu("refresh")


					$("#layoutP" + id).selectmenu({
						disabled: false
					})
					$("#layoutP" + id).val(layout)
					$("#layoutP" + id).selectmenu("refresh")


					$("#page" + (parseInt(id) + 1)).checkboxradio({
						disabled: false,
					})

				})
			}

			// load in graph
			graphMLIOHandler
				.readFromGraphMLText(graphComponent.graph, myGraph)
				.then(() => {
					graphComponent.fitGraphBounds();

					checkLabelsAndTags();

					// took out a timeout, seems to work fine
					constraints.forEach(function (c) {
						deserialize(c)
					})
				})
		};
		reader.readAsText(file);
	}

	/*
	 * When a graph is loaded in, this Method checks if every node / edge has a label and a tag and if not, assigns those
	 */

	function checkLabelsAndTags() {
		var nodes = graphComponent.graph.nodes.toArray();

		nodes.forEach(function (n) {
			if (n.labels.size == 0) {
				var label = getNextLabel("node")
				graphComponent.graph.addLabel(n, label.toString())
			}
			if (n.tag == null) {
				n.tag = getNextTag()
			}
		})

		var edges = graphComponent.graph.edges.toArray();
		edges.forEach(function (e) {
			if (e.labels.size == 0) {
				var label = getNextLabel("edge")
				graphComponent.graph.addLabel(e, label.toString())
			}
			if (e.tag == null) {
				e.tag = e.sourceNode.tag + "-" + e.targetNode.tag
			}
		})

	}


	/*
	 * saves a graph as graphml including pages, page constraints, page types and further constraints
	 * parameter: filename, string
	 */

	function saveFile(filename) {
		if (filename == "") {
			filename = "unnamed"
		}

		graphMLIOHandler
			.write(graphComponent.graph)
			.then(result => myGraph = result);

		setTimeout(function () {

			myGraph = myGraph.slice(0, -10)

			myGraph = myGraph + "\t<pages>"

			var pages = getAvailablePages()
			pages.forEach(function (p) {
				myGraph = myGraph + "\r\n\t\t<page>"
				myGraph = myGraph + "\r\n\t\t\t<id>P" + p + "</id>"
				myGraph = myGraph + "\r\n\t\t\t<type>" + $("#typeP" + p).val() + "</type>"
				myGraph = myGraph + "\r\n\t\t\t<layout>" + $("#layoutP" + p).val() + "</layout>"
				myGraph = myGraph + "\r\n\t\t</page>"

			})
			myGraph = myGraph + "\r\n\t</pages>\r\n\t<constraints>\r\n"


			constraintsArray.forEach(function (c) {
				myGraph = myGraph + c.serialize() + "\r\n"
			})

			myGraph = myGraph + "\t</constraints>\r\n</graphml>"

			FileSaveSupport.save(myGraph, filename + ".graphml")

		}, 1);
	}

	/*
	 * this function connects the html-buttons with their functionalities
	 */

	function registerCommands() {

		/*
		 * file tab
		 */
		 /*
		document.querySelector("#NewButton").addEventListener("click", () => {
			graphComponent.graph.clear();
			deleteAllConstraints();
			disableFollowingPages(2);
			deselectPage(2);
			yfiles.input.ICommand.FIT_GRAPH_BOUNDS.execute(null, graphComponent);

		})
		*/

		document.getElementById('OpenButton').addEventListener('change', readFile, false);

		document.querySelector("#SaveDialogButton").addEventListener("click", () => {
			$("#saveDialog").dialog("open")
		})

		document.querySelector("#saveButton").addEventListener("click", () => {
			saveFile($("#fileName").val());
			$("#saveDialog").dialog("close")
		})

		document.querySelector("#cancelSaveDialog").addEventListener("click", () => {
			$("#saveDialog").dialog("close")
		})

		document.querySelector("#ServerButton").addEventListener("click", () => {
			if (typeof (window.localStorage) !== "undefined") {
				$("#serverDialog").dialog("open")
			} else {
				alert("This browser does not support local storage, which leads to problems with computation. Please consider using another browser or stay with the standard server.")
			}
		})

		document.querySelector("#okChangeServer").addEventListener("click", () => {
			var newurl = $("#serverUrl").val()

			if (newurl.split("")[newurl.length - 1] == "/") {
				newurl = newurl.split("")
				newurl.pop()
				newurl = newurl.join("")
			}

			// check if server is answering correctly
			$.ajax({
				url: newurl + "/embeddings",
				success: function () {
					document.getElementById("displayCurrentServer").innerHTML = newurl;
					window.localStorage.setItem("currentServer", newurl)
				},
				error: function () {
					alert("This server does not host functionality for computation of linear layouts. Please try a different server.")
				}
			})


			$("#serverDialog").dialog("close")
		})

		document.querySelector("#abortChangeServer").addEventListener("click", () => {
			$("#serverDialog").dialog("close")
		})

		document.querySelector("#resetServer").addEventListener("click", () => {
			window.localStorage.setItem("currentServer", standardServer)
			document.getElementById("displayCurrentServer").innerHTML = currentServer;
			$("#serverDialog").dialog("close")
		})

		/*
		 * edit tab
		 */

		document.querySelector("#UndoButton").addEventListener("click", () => {
			yfiles.input.ICommand.UNDO.execute({ target: graphComponent });
		})

		document.querySelector("#RedoButton").addEventListener("click", () => {
			yfiles.input.ICommand.REDO.execute({ target: graphComponent });
		})

		document.querySelector("#SelectAllButton").addEventListener("click", () => {
			yfiles.input.ICommand.SELECT_ALL.execute({ target: graphComponent });
		})

		graphComponent.clipboard.addElementsCopiedListener(copyOfConstraintsInClipboard);

		document.querySelector("#CopyButton").addEventListener("click", () => {
			yfiles.input.ICommand.COPY.execute({ target: graphComponent });
		})

		document.querySelector("#CutButton").addEventListener("click", () => {
			yfiles.input.ICommand.CUT.execute({ target: graphComponent });

		})

		graphComponent.clipboard.addElementsPastedListener(computationAfterPaste);

		document.querySelector("#PasteButton").addEventListener("click", () => {
			yfiles.input.ICommand.PASTE.execute({ target: graphComponent });
			console.log("trying to call listenener");
		})

		document.querySelector("#DeleteButton").addEventListener("click", () => {
			yfiles.input.ICommand.DELETE.execute({ target: graphComponent });

		})

		document.querySelector("#yesDelete").addEventListener("click", () => {
			var selection = graphComponent.selection;
			var adjEdges = [];

			var delNodes = selection.selectedNodes.toArray();
			delNodes.forEach(function (node) {
				var arr = graphComponent.graph.edgesAt(node).toArray();
				arr.forEach(function (edge) {
					adjEdges.push(edge)
				})

			})

			var delItems = selection.toArray();
			delItems = delItems.concat(adjEdges)


			delItems.forEach(function (item) {
				deleteRelatedConstraintsDeluxe(item);
			})

			graphComponent.inputMode.deleteSelection()
			$("#deleteDialog").dialog("close");
		})

		document.querySelector("#noDontDelete").addEventListener("click", () => {
			$("#deleteDialog").dialog("close");
		})

		/*
		 * view tab
		 */

		document.querySelector("#ZoomInButton").addEventListener("click", () => {
			yfiles.input.ICommand.INCREASE_ZOOM.execute({ target: graphComponent });
		})

		document.querySelector("#ZoomOutButton").addEventListener("click", () => {
			yfiles.input.ICommand.DECREASE_ZOOM.execute({ target: graphComponent });
		})

		document.querySelector("#FitButton").addEventListener("click", () => {
			yfiles.input.ICommand.FIT_GRAPH_BOUNDS.execute({ target: graphComponent });
		})

		document.querySelector('#GridButton').addEventListener("click", () => {
			grid.visible = !grid.visible;
			if (grid.visible) {
				updateSnapType('all')
			} else {
				updateSnapType('none')
			}
			graphComponent.invalidate();

		})

		document.querySelector('#marqueeAll').addEventListener("click", () => {
			changeSelectionMode('all')
		})

		document.querySelector('#marqueeNodes').addEventListener("click", () => {
			changeSelectionMode('nodes')
		})
		document.querySelector('#marqueeEdges').addEventListener("click", () => {
			changeSelectionMode('edges')
		})

		/* Layout Tab */

		document.querySelector("#hierLayoutButton").addEventListener("click", () => {
			resetToPolylineStyle();
			graphComponent.morphLayout(new yfiles.hierarchic.HierarchicLayout());
			graphComponent.fitGraphBounds();
		})
		document.querySelector("#organicLayoutButton").addEventListener("click", () => {
			resetToPolylineStyle();
			graphComponent.morphLayout(new yfiles.organic.OrganicLayout());
			graphComponent.fitGraphBounds();
		})
		document.querySelector("#orthoLayoutButton").addEventListener("click", () => {
			resetToPolylineStyle();
			graphComponent.morphLayout(new yfiles.orthogonal.OrthogonalLayout());
			graphComponent.fitGraphBounds();
		})
		document.querySelector("#circLayoutButton").addEventListener("click", () => {
			resetToPolylineStyle();
			graphComponent.morphLayout(new yfiles.circular.CircularLayout());
			graphComponent.fitGraphBounds();
		})

		document.querySelector("#treeLayoutButton").addEventListener("click", () => {
			resetToPolylineStyle();
			const treeLayout = new yfiles.tree.TreeLayout();
			const treeReductionStage = new yfiles.tree.TreeReductionStage();

			//specify the routing algorithm for the non-tree edges
			const router = new yfiles.router.EdgeRouter();
			router.scope = yfiles.router.Scope.ROUTE_AFFECTED_EDGES;
			treeReductionStage.nonTreeEdgeRouter = router;
			treeReductionStage.nonTreeEdgeSelectionKey = router.affectedEdgesDpKey;

			treeLayout.appendStage(treeReductionStage);
			graphComponent.morphLayout(treeLayout);
			treeLayout.removeStage(treeReductionStage);

			graphComponent.fitGraphBounds();

		})
		document.querySelector("#balloonLayoutButton").addEventListener("click", () => {
			resetToPolylineStyle();
			const treeLayout = new yfiles.tree.BalloonLayout();
			const treeReductionStage = new yfiles.tree.TreeReductionStage();

			//specify the routing algorithm for the non-tree edges
			const router = new yfiles.router.EdgeRouter();
			router.scope = yfiles.router.Scope.ROUTE_AFFECTED_EDGES;
			treeReductionStage.nonTreeEdgeRouter = router;
			treeReductionStage.nonTreeEdgeSelectionKey = router.affectedEdgesDpKey;

			treeLayout.appendStage(treeReductionStage);
			graphComponent.morphLayout(treeLayout);
			treeLayout.removeStage(treeReductionStage);

			graphComponent.fitGraphBounds();

		})
		document.querySelector("#radialLayoutButton").addEventListener("click", () => {
			resetToPolylineStyle();
			graphComponent.morphLayout(new yfiles.radial.RadialLayout());
			graphComponent.fitGraphBounds();
		})


		/* Tools Tab */
		document.querySelector("#localPageNumber").addEventListener("click", () => {
			setLocalPageNumberValuesFromStorage();
			$("#enableLocalPageNumber").dialog("open")
		})

		document.querySelector("#yesApply").addEventListener("click", () => {
			//remove old constraint tag
			for (var s = 0; s < constraintsArray.length; s++) {
				if (constraintsArray[s].type == "LOCAL_PAGE_NUMBER") {
					var con = new LocalPageNumber(window.localStorage.getItem("nrLocalPage"));
					$("#constraintTags").tagit("removeTagByLabel", con.getPrintable())
				}
			}
			//fill storage with new values
			if (document.getElementById("yesEnable").checked == true) {
				lqnBool = false;
				window.localStorage.setItem("enableLocalPage", true);
				var nrLocalPage = document.getElementById("numberLocalPage").value;
				window.localStorage.setItem("nrLocalPage", nrLocalPage);
			} else if (document.getElementById("yesEnable").checked == false) {
				lqnBool = true;
				window.localStorage.setItem("enableLocalPage", false);
				//window.localStorage.setItem("numberLocalPage", 0);
			}
			//create constraint
			if (!lqnBool) {
				var con = new LocalPageNumber(window.localStorage.getItem("nrLocalPage"));
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())

				$("#constraintTags").tagit({
					afterTagRemoved: function (event, ui) {
						if (ui.tagLabel == "LocalPages(" + window.localStorage.getItem("nrLocalPage") + ")") {
							lqnBool = true;
							document.getElementById("localPageNumber").checked = lqnBool;
						}
						window.localStorage.setItem("enableLocalPage", false);
						//window.localStorage.setItem("nrLocalPage", 0);
					}
				});
			}
			/*
			else {
				var con = new LocalPageNumber(window.localStorage.getItem("nrLocalPage"));
				var newConstraintsArray = []
				let t;
				for (t = 0; t < constraintsArray.length; t++) {
					if (constraintsArray[t].type != "LOCAL_PAGE_NUMBER") {
						newConstraintsArray.push(constraintsArray[t])
					}
				}
				constraintsArray = newConstraintsArray
				try {
					$("#constraintTags").tagit("removeTagByLabel", con.getPrintable())
					lqnBool = true;
				}
				catch (error) {
					//removedTagManuall = false;
				}
			}
			*/
			document.getElementById("localPageNumber").checked = lqnBool;
			$("#enableLocalPageNumber").dialog("close")
		})

		document.querySelector("#noDontApply").addEventListener("click", () => {
			document.getElementById("localPageNumber").checked = lqnBool;
			$("#enableLocalPageNumber").dialog("close")
		})

		$("#enableLocalPageNumber").dialog( {
			autoOpen: false,
			resizable: false,
			width: 250,
			modal: true,
			open: function( event, ui ) {
				$("#greyDiv").show()
			},
			beforeClose: function( event, ui ) {
				lqnBool = false;
				document.getElementById("localPageNumber").checked = lqnBool;
				$("#greyDiv").hide();
			}
		});

		function setLocalPageNumberValuesFromStorage() {
			var enableLocalPageStorage = window.localStorage.getItem("enableLocalPage");
			if (enableLocalPageStorage != null) {
				if (enableLocalPageStorage == "true") {
					//document.getElementById("noEnable").checked = false;
					document.getElementById("yesEnable").checked = true;
				} else if (enableLocalPageStorage == "false") {
					document.getElementById("noEnable").checked = true;
					//document.getElementById("yesEnable").checked = false;
				}
			} else {
				document.getElementById("noEnable").checked = true;
				//document.getElementById("yesEnable").checked = false;
			}
			var nrOfLocalPage = parseInt(window.localStorage.getItem("nrLocalPage"));
			if (window.localStorage.getItem("nrLocalPage") != null) {
				document.getElementById("numberLocalPage").value = nrOfLocalPage;
			} else {
				document.getElementById("numberLocalPage").value = 0;
			}
			enableInputPageNumber();
		}

		function enableInputPageNumber() {
			var enable = document.getElementById("yesEnable").checked;
			if (enable == true) {
				document.getElementById("allowedLocalPageNumber").hidden = false;
			}
			else if (enable == false) {
				document.getElementById("allowedLocalPageNumber").hidden = true;
			}
		}

		document.getElementById("enableLocalPageNumber").onchange = function() {
			enableInputPageNumber();
		}

		document.querySelector("#resizableNodes").addEventListener("click", () => {
			nodesStableSize = !nodesStableSize;

			if (nodesStableSize) {
				graphComponent.inputMode.showHandleItems = yfiles.graph.GraphItemTypes.ALL & ~yfiles.graph.GraphItemTypes.NODE;
			} else if (!nodesStableSize) {
				graphComponent.inputMode.showHandleItems = yfiles.graph.GraphItemTypes.ALL;
			}

		})

		document.querySelector("#doubleEdges").addEventListener("click", () => {
			allowDoubleEdges = !allowDoubleEdges;
		})

		document.querySelector("#directedEdges").addEventListener("click", () => {
			treatEdgesAsDirected = !treatEdgesAsDirected;
			if (treatEdgesAsDirected) {
				var con = new TreatGraphDirected([graphComponent.graph.nodes.toArray()[0]]);
				constraintsArray.push(con);
				$("#constraintTags").tagit("createTag", con.getPrintable())
				$("#constraintTags").tagit({
					afterTagRemoved: function (event, ui) {
						if (ui.tagLabel == "TreatGraphAsDirected") {
							removedTagManually = !removedTagManually
							if (removedTagManually) {
								treatEdgesAsDirected = true;
								document.getElementById('directedEdges').click();
								let color = 'black';
								resetDefaultEdgesStyle(false, color)
								//document.getElementById('directedEdges').checked
								//$("#directedEdges").prop("checked", false);
								removedTagManually = false;
							}
						}
					}
				});
				let color = 'black';
				resetDefaultEdgesStyle(true, color);
			}
			else {
				var con = new TreatGraphDirected(["1"])
				//constraintsArray = [];
				var newConstraintsArray = []
				let t;
				for (t = 0; t < constraintsArray.length; t++) {
					if (constraintsArray[t].type != "TREAT_GRAPH_DIRECTED") {
						newConstraintsArray.push(constraintsArray[t])
					}
				}
				constraintsArray = newConstraintsArray
				try {
					$("#constraintTags").tagit("removeTagByLabel", con.getPrintable())
					removedTagManually = true;
				}
				catch (error) {
					removedTagManually = false;
				}
				let color = 'black';
				resetDefaultEdgesStyle(false, color);
			}
		})

		document.querySelector("#stellation").addEventListener("click", () => {

			var selectedNodes = graphComponent.selection.selectedNodes.toArray();

			if (selectedNodes.length == 0) {
				const adapter = new yfiles.layout.YGraphAdapter(graphComponent.graph);
				var ygraph = adapter.yGraph;

				if (!yfiles.algorithms.PlanarEmbedding.isPlanar(ygraph)) {
					alert("The input graph cannot be stellated because it is not planar.");
				}
				var planarEmbedding = new yfiles.algorithms.PlanarEmbedding(ygraph);
				var outerFace = planarEmbedding.outerFace;

				var alreadyStellated = [];

				planarEmbedding.faces.forEach(face => {
					var x = 0;
					var y = 0;

					var stellate = graphComponent.graph.createNode({
						layout: new yfiles.geometry.Rect(0, 0, 20, 20),
						tag: getNextTag()
					});
					graphComponent.graph.addLabel(stellate, getNextLabel("node").toString());

					face.forEach(dart => {
						const source = adapter.getOriginalNode(dart.reversed ? dart.associatedEdge.source : dart.associatedEdge.target);
						const e = graphComponent.graph.createEdge({
							source: source,
							target: stellate,
							tag: source.tag + "-(0)-" + stellate.tag
						});
						graphComponent.graph.addLabel(e, getNextLabel("edge").toString())
						x = x + source.layout.center.x;
						y = y + source.layout.center.y;
					});
					x = x / face.size;
					y = y / face.size;
					graphComponent.graph.setNodeCenter(stellate, new yfiles.geometry.Point(x, y));

				});


			} else {
				var x = 0;
				var y = 0;

				var stellate = graphComponent.graph.createNode({
					layout: new yfiles.geometry.Rect(0, 0, 20, 20),
					tag: getNextTag()
				});
				graphComponent.graph.addLabel(stellate, getNextLabel("node").toString());

				selectedNodes.forEach(node => {
					x = x + node.layout.center.x;
					y = y + node.layout.center.y;

					const e = graphComponent.graph.createEdge({
						source: node,
						target: stellate,
						tag: node.tag + "-" + stellate.tag
					});
					graphComponent.graph.addLabel(e, getNextLabel("edge").toString())
				})
				x = x / selectedNodes.length;
				y = y / selectedNodes.length;
				graphComponent.graph.setNodeCenter(stellate, new yfiles.geometry.Point(x, y));
			}
		})

		document.querySelector("#threeStellation").addEventListener("click", () => {
			var selectedNodes = graphComponent.selection.selectedNodes.toArray();

			if (selectedNodes.length < 3) {
				const adapter = new yfiles.layout.YGraphAdapter(graphComponent.graph);
				var ygraph = adapter.yGraph;

				if (!yfiles.algorithms.PlanarEmbedding.isPlanar(ygraph)) {
					alert("The input graph cannot be stellated because it is not planar.");
				}
				var planarEmbedding = new yfiles.algorithms.PlanarEmbedding(ygraph);
				var outerFace = planarEmbedding.outerFace;


				planarEmbedding.faces.forEach(function (face) {
					if (face.size == 3) {
						var x = 0;
						var y = 0;

						face.forEach(function (dart) {
							const source = adapter.getOriginalNode(dart.reversed ? dart.associatedEdge.source : dart.associatedEdge.target);
							x = x + source.layout.center.x;
							y = y + source.layout.center.y;
						})

						x = x / face.size
						y = y / face.size

						// create 3 new nodes
						var s1 = graphComponent.graph.createNode({
							layout: new yfiles.geometry.Rect(x, y, 20, 20),
							tag: getNextTag()
						})
						graphComponent.graph.addLabel(s1, getNextLabel("node").toString());

						var s2 = graphComponent.graph.createNode({
							layout: new yfiles.geometry.Rect(x, y, 20, 20),
							tag: getNextTag()
						})
						graphComponent.graph.addLabel(s2, getNextLabel("node").toString());

						var s3 = graphComponent.graph.createNode({
							layout: new yfiles.geometry.Rect(x, y, 20, 20),
							tag: getNextTag()
						})
						graphComponent.graph.addLabel(s3, getNextLabel("node").toString());


						// create 3 new edges
						var e1 = graphComponent.graph.createEdge({
							source: s1,
							target: s2,
							tag: s1.tag + "-" + s2.tag
						})
						graphComponent.graph.addLabel(e1, getNextLabel("edge").toString())

						var e2 = graphComponent.graph.createEdge({
							source: s2,
							target: s3,
							tag: s2.tag + "-" + s3.tag
						})
						graphComponent.graph.addLabel(e2, getNextLabel("edge").toString())

						var e3 = graphComponent.graph.createEdge({
							source: s1,
							target: s3,
							tag: s1.tag + "-" + s3.tag
						})
						graphComponent.graph.addLabel(e3, getNextLabel("edge").toString())


						// create 6 new edges,2 for each dart
						var edgesToNewNodes = [[s1, s2], [s3, s1], [s2, s3]]
						var i = 0;

						face.forEach(function (dart) {
							const source = adapter.getOriginalNode(dart.reversed ? dart.associatedEdge.source : dart.associatedEdge.target);
							var ea = graphComponent.graph.createEdge({
								source: source,
								target: edgesToNewNodes[i][0],
								tag: source.tag + "-(0)-" + edgesToNewNodes[i][0].tag,
							})
							graphComponent.graph.addLabel(ea, getNextLabel("edge").toString())

							var eb = graphComponent.graph.createEdge({
								source: source,
								target: edgesToNewNodes[i][1],
								tag: source.tag + "-(0)-" + edgesToNewNodes[i][1].tag
							})
							graphComponent.graph.addLabel(eb, getNextLabel("edge").toString())
							i++;
						})

					}
				})
			} else if (selectedNodes.length == 3) {
				var x = 0;
				var y = 0;

				selectedNodes.forEach(function (n) {
					x = x + n.layout.center.x;
					y = y + n.layout.center.y;
				})

				x = x / selectedNodes.length
				y = y / selectedNodes.length

				// create 3 new nodes
				var s1 = graphComponent.graph.createNode({
					layout: new yfiles.geometry.Rect(x, y, 20, 20),
					tag: getNextTag()
				})
				graphComponent.graph.addLabel(s1, getNextLabel("node").toString());

				var s2 = graphComponent.graph.createNode({
					layout: new yfiles.geometry.Rect(x, y, 20, 20),
					tag: getNextTag()
				})
				graphComponent.graph.addLabel(s2, getNextLabel("node").toString());

				var s3 = graphComponent.graph.createNode({
					layout: new yfiles.geometry.Rect(x, y, 20, 20),
					tag: getNextTag()
				})
				graphComponent.graph.addLabel(s3, getNextLabel("node").toString());

				// create 3 new edges
				var e1 = graphComponent.graph.createEdge({
					source: s1,
					target: s2,
					tag: s1.tag + "-" + s2.tag
				})
				graphComponent.graph.addLabel(e1, getNextLabel("edge").toString())

				var e2 = graphComponent.graph.createEdge({
					source: s2,
					target: s3,
					tag: s2.tag + "-" + s3.tag
				})
				graphComponent.graph.addLabel(e2, getNextLabel("edge").toString())

				var e3 = graphComponent.graph.createEdge({
					source: s1,
					target: s3,
					tag: s1.tag + "-" + s3.tag
				})
				graphComponent.graph.addLabel(e3, getNextLabel("edge").toString())

				// create 6 new edges,2 for each dart
				var edgesToNewNodes = [[s1, s2], [s3, s1], [s2, s3]]
				var i = 0;

				selectedNodes.forEach(function (n) {
					var ea = graphComponent.graph.createEdge({
						source: n,
						target: edgesToNewNodes[i][0],
						tag: n.tag + "-(0)-" + edgesToNewNodes[i][0].tag,
					})
					graphComponent.graph.addLabel(ea, getNextLabel("edge").toString())

					var eb = graphComponent.graph.createEdge({
						source: n,
						target: edgesToNewNodes[i][1],
						tag: n.tag + "-(0)-" + edgesToNewNodes[i][1].tag
					})
					graphComponent.graph.addLabel(eb, getNextLabel("edge").toString())


					i++;
				})

			}
		})

		document.querySelector("#edgeStellation").addEventListener("click", () => {
			var selectedEdges = graphComponent.selection.selectedEdges.toArray();
			var selectedNodes = graphComponent.selection.selectedNodes.toArray();

			if (selectedEdges.length != 0) {
				selectedEdges.forEach(function (e) {
					stellateEdge(e)
				})
			}

			if (selectedEdges.length == 0) {
				var edges = graphComponent.graph.edges.toArray();
				edges.forEach(function (e) {
					stellateEdge(e)
				})
			}

		})

		/*Random new graph Dialog*/
		document.querySelector("#NewButton").addEventListener("click", () => {
			$("#computeRandomDialog").dialog({
				width: 300
			})
			$("#computeRandomDialog").dialog("open")
		})

		document.querySelector("#cancelRandomGraph").addEventListener("click", () => {
			$("#computeRandomDialog").dialog("close")
		})

		document.querySelector("#computeRandomGraph").addEventListener("click", () => {
			graphComponent.graph.clear();
			deleteAllConstraints();
			disableFollowingPages(2);
			deselectPage(2);
			$("#computeRandomDialog").dialog("close")
			computeRandomGraph();
		})

		//if the selected type of graph changes, some options may get en/disabled
		document.getElementById("graphType").onchange = function() {
			var option = document.getElementById("graphType").value;
			if (option=="tree"|option=="complete"|option=="maximalPlanar"|option=="planar3Tree") {
				document.getElementById("divVertices").hidden = false;
				document.getElementById("divEdges").hidden = true;
				document.getElementById("divBipartiteVerticesM").hidden = true;
				document.getElementById("divBipartiteVerticesN").hidden = true;
			}
			else if (option=="completeBipartite") {
				document.getElementById("divBipartiteVerticesM").hidden = false;
				document.getElementById("divBipartiteVerticesN").hidden = false;
				document.getElementById("divVertices").hidden = true;
				document.getElementById("divEdges").hidden = true;
			}
			else {
				document.getElementById("divVertices").hidden = false;
				document.getElementById("divEdges").hidden = false;
				document.getElementById("divBipartiteVerticesM").hidden = true;
				document.getElementById("divBipartiteVerticesN").hidden = true;
			}
		}

		//if the selection of checkboxes change, remove their constraints
		document.getElementById("pages").addEventListener("change", function() {
			var nrOfPages = parseInt(window.localStorage.getItem("numberOfPages"));
			for (var i = 1; i <= nrOfPages; i++) {
				var checked = document.getElementById("page"+i).checked;
				if (!checked) {
					var temp = findRelatedConstraintsDeluxe("P" + i);
					if (temp.length > 0) {
						$("#deselectPageDialog").dialog("open");
					}
				}
			}
		})


		document.querySelector("#yesDeselectPage").addEventListener("click", () => {
			var nrOfPages = parseInt(window.localStorage.getItem("numberOfPages"));
			for (var i = 1; i <= nrOfPages; i++) {
				var checked = document.getElementById("page"+i).checked;
				if (!checked) {
					var temp = findRelatedConstraintsDeluxe("P" + i);
					if (temp.length > 0) {
						deleteRelatedConstraintsDeluxe("P" + i);
						$("#deselectPageDialog").dialog("close");
					}
				}
			}
		})

		function cancelSelectPage() {
			var nrOfPages = parseInt(window.localStorage.getItem("numberOfPages"));
			for (var i = 1; i <= nrOfPages; i++) {
				var p = document.getElementById("page"+i);
				var checked = p.checked;
				if (!checked) {
					var temp = findRelatedConstraintsDeluxe("P" + i);
					if (temp.length > 0) {
						for (var k = i; k > 0; k--) {
							document.getElementById("page"+k).checked = true;
							$("#page" + k).button("refresh");
							$("#page" + k).checkboxradio({
								disabled: false
							})
							$("#typeP" + k).selectmenu({
								disabled: false
							})
							var type = document.getElementById("typeP"+k).value;
							$("#typeP" + k).val(type)
							$("#typeP" + k).selectmenu("refresh")
							$("#layoutP" + k).selectmenu({
								disabled: false
							})
							var layout = document.getElementById("layoutP"+k).value;
							$("#layoutP" + k).val(layout)
							$("#layoutP" + k).selectmenu("refresh")
						}

						p.checked = true;
						$("#page" + i).button("refresh");
						$("#page" + i).checkboxradio({
							disabled: false
						})
						var j = i+1;
						if (j <= nrOfPages) {
							$("#page" + j).checkboxradio({
								disabled: false
							})
						}
						$("#typeP" + i).selectmenu({
							disabled: false
						})
						var type = document.getElementById("typeP"+i).value;
						$("#typeP" + i).val(type)
						$("#typeP" + i).selectmenu("refresh")
						$("#layoutP" + i).selectmenu({
							disabled: false
						})
						var layout = document.getElementById("layoutP"+i).value;
						$("#layoutP" + i).val(layout)
						$("#layoutP" + i).selectmenu("refresh")
						$("#deselectPageDialog").dialog("close");
					}
				}
			}
		}

		document.querySelector("#noDontDeselectPage").addEventListener("click", () => {
			cancelSelectPage();
		})

		$("#deselectPageDialog").dialog( {
			autoOpen: false,
			resizable: false,
			width: 250,
			modal: true,
			open: function( event, ui ) {
				$("#greyDiv").show()
			},
			beforeClose: function( event, ui ) {
				cancelSelectPage();
				$("#greyDiv").hide();
			}
		});




		/*Submit Dialog Button*/
		document.querySelector("#submitButton").addEventListener("click", () => {
			$("#computeDialog").dialog("open")
		})

		document.querySelector("#yesCompute").addEventListener("click", () => {
			$("#computeDialog").dialog("close")
			$("#loadingDiv").show()
			computeLinearLayout()
		})

		document.querySelector("#noCompute").addEventListener("click", () => {
			$("#computeDialog").dialog("close")
		})

		document.querySelector("#yesCompute2").addEventListener("click", () => {
			$("#computeDialog").dialog("close")
			computeLinearLayout()
		})

		document.querySelector("#noCompute2").addEventListener("click", () => {
			$("#computeDialog").dialog("close")
		})

		document.querySelector("#yesSaveCompute").addEventListener("click", () => {

			$("#computeDialog").dialog("close")
			$("#saveDialog").dialog("open")

		})

		document.querySelector("#okayWentWrong").addEventListener("click", () => {
			$("#wentWrong").dialog("close")
			$("#loadingDiv").hide()
		})

		/*Export Dialog*/

		document.querySelector('#ExportAsImage').addEventListener("click", () => {
			const scale = parseFloat(1)
			const margin = parseFloat(5)

			clientSideImageExport = new ClientSideImageExport();

			clientSideImageExport.scale = scale
			clientSideImageExport.margins = new yfiles.geometry.Insets(margin)

			clientSideImageExport
				.exportImage(graphComponent.graph, null)
				.then(pngImage => {
					FileSaveSupport.save(pngImage.src, 'graph.png')
				})

			$("#exportDialog").dialog("close");
		})

		document.querySelector('#ExportAsPdf').addEventListener("click", () => {
			clientSidePdfExport = new ClientSidePdfExport()

			const scale = parseFloat(1)
			const margin = parseFloat(5)

			clientSidePdfExport.scale = scale
			clientSidePdfExport.margins = new yfiles.geometry.Insets(margin)

			clientSidePdfExport.exportPdf(graphComponent.graph, null).then(pdfUrl => {
				FileSaveSupport.save(pdfUrl, 'graph.pdf')
			}).catch(() => {
				alert(
					'Saving directly to the filesystem is not supported by this browser. Make sure to save your graph and try with another browser'
				)
			})

			$("#exportDialog").dialog("close");

		})

		// Order Dialog
		$("#requireOrder").click(function () {
			var constr = new RequirePartialOrder(graphComponent.selection.selectedNodes.toArray())
			constraintsArray.push(constr)
			$("#constraintTags").tagit("createTag", constr.getPrintable())
			$("#orderingDialog").dialog("close")
		})

		$("#forbidOrder").click(function () {
			var constr = new ForbidPartialOrder(graphComponent.selection.selectedNodes.toArray())
			constraintsArray.push(constr)
			$("#constraintTags").tagit("createTag", constr.getPrintable())
			$("#orderingDialog").dialog("close")
		})

		// Stats Dialog
		$("#statsButton").click(function () {
			var graph = graphComponent.graph
			const adapter = new yfiles.layout.YGraphAdapter(graphComponent.graph);
			var ygraph = adapter.yGraph

			var nrOfVertices = graph.nodes.size
			var nrOfEdges = graph.edges.size
			var isPlanar = yfiles.algorithms.PlanarEmbedding.isPlanar(ygraph)
			var isConnected = yfiles.algorithms.GraphChecker.isConnected(ygraph)

			var cyclePath = yfiles.algorithms.Cycles.findCycle(ygraph, treatEdgesAsDirected)
			var isAcyclic;
			if (cyclePath.size == 0) {
				isAcyclic = true;
			} else {
				isAcyclic = false;
			}

			var isTree = yfiles.algorithms.Trees.isTree(ygraph)
			var isBipartite = yfiles.algorithms.GraphChecker.isBipartite(ygraph)

			document.getElementById("nrOfVertices").innerHTML = nrOfVertices
			document.getElementById("nrOfEdges").innerHTML = nrOfEdges
			document.getElementById("isPlanar").innerHTML = isPlanar
			if (isPlanar) { document.getElementById("isPlanar").style.color = "green" } else { document.getElementById("isPlanar").style.color = "red" }
			document.getElementById("isConnected").innerHTML = isConnected
			if (isConnected) { document.getElementById("isConnected").style.color = "green" } else { document.getElementById("isConnected").style.color = "red" }
			document.getElementById("isAcyclic").innerHTML = isAcyclic
			if (isAcyclic) { document.getElementById("isAcyclic").style.color = "green" } else { document.getElementById("isAcyclic").style.color = "red" }
			document.getElementById("isTree").innerHTML = isTree
			if (isTree) { document.getElementById("isTree").style.color = "green" } else { document.getElementById("isTree").style.color = "red" }

			document.getElementById("isBipartite").innerHTML = isBipartite
			if (isBipartite) { document.getElementById("isBipartite").style.color = "green" } else { document.getElementById("isBipartite").style.color = "red" }

			if (treatEdgesAsDirected) {
				document.getElementById("reducedTr").style.display = "table-row";
				document.getElementById("reducedTr").style.verticalAlign = "top";

				try {
					const resultTransitiveReduction = new yfiles.analysis.TransitiveReduction().run(graphComponent.graph);
					if (resultTransitiveReduction.edgesToRemove.size > 0) {
						// reducible
						var isReduced = false;
						document.getElementById("isReduced").style.color = "red";

						var isReducedOutputStr = isReduced + "<br><br>";
						for (const edge of resultTransitiveReduction.edgesToRemove) {
							isReducedOutputStr = isReducedOutputStr + "Edge(" + edge.sourceNode + " ," + edge.targetNode + ") is transitive<br>"
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
				catch (error) {
					// not reducible
					var isReduced = true;
					document.getElementById("isReduced").style.color = "green";
					document.getElementById("isReduced").innerHTML = isReduced;
				}
			}
			else {
				document.getElementById("reducedTr").style.display = "none";
			}

			$("#statsDialog").dialog("open")
		})


	}

	//Add new Pages
	document.querySelector("#AddPage").addEventListener("click", () => {
		var currentNOP = parseInt(window.localStorage.getItem("numberOfPages"));
		numberOfPages = currentNOP+1;
		window.localStorage.setItem("numberOfPages", numberOfPages);
		$("#pages").append(
				'<div class="pagesSettings">'+
				'<label for="page'+numberOfPages+'" id="labelP'+numberOfPages+'">Page '+numberOfPages+'</label> <input type="checkbox"'+
				'name="page'+numberOfPages+'" id="page'+numberOfPages+'"  onclick="handlePageCheckbox('+numberOfPages+')" > <select id="typeP'+numberOfPages+'" name="typeP'+numberOfPages+'">'+
				'<option value="STACK">stack</option>'+
				'<option value="QUEUE">queue</option>'+
				'<option value="">rique</option>'+
				'<option value="NONE">undefined</option>' +
				'</select> <select id="layoutP'+numberOfPages+'" name="layoutP'+numberOfPages+'">'+
				'<option value="NONE">maximal</option>'+
				'<option value="FOREST">forest</option>'+
				'<option value="TREE">tree</option>'+
				'<option value="DISPERSIBLE">matching</option>'+
				'</select>'+
				'</div>'
		)
		$("#page"+numberOfPages).checkboxradio({
			disabled: false,
			width: 150
		})
		$("#typeP"+numberOfPages).selectmenu({
			disabled:true,
			position: { my : "top left", at: "top center" },
			width: 120
		});
		$("#layoutP"+numberOfPages).selectmenu({
			disabled:true,
			position: { my : "top left", at: "top center" },
			width: 120
		});
		if ($(window).outerWidth() < 1200) {
			$("#page"+numberOfPages).checkboxradio({
				width: 70,
				label: " "
			})
			$("#typeP"+numberOfPages).selectmenu("option", "width", "70")
			$("#layoutP"+numberOfPages).selectmenu("option", "width", "70")
		}
		disablePages();
	})

	//Remove Page
	document.querySelector("#RemovePage").addEventListener("click", () => {
		var currentNOP = parseInt(window.localStorage.getItem("numberOfPages"));
		var temp = findRelatedConstraintsDeluxe("P" + currentNOP);
		if (temp.length > 0) {
			$("#deletePageDialog").dialog("open");
		} else {
			$("#labelP"+currentNOP).remove();
			$("#page"+currentNOP).remove();
			$("#typeP"+currentNOP).remove();
			$("#layoutP"+currentNOP).remove();
			numberOfPages = currentNOP-1;
			window.localStorage.setItem("numberOfPages", numberOfPages);
		}
	})

	document.querySelector("#yesDeletePage").addEventListener("click", () => {
		var currentNOP = parseInt(window.localStorage.getItem("numberOfPages"));
		deleteRelatedConstraintsDeluxe("P" + currentNOP);
		var removePage = document.getElementById("page"+numberOfPages);
		var label = document.getElementById("labelP"+numberOfPages);
		$("#labelP"+currentNOP).remove();
	  $("#page"+currentNOP).remove();
		$("#typeP"+currentNOP).remove();
		$("#layoutP"+currentNOP).remove();
		numberOfPages = currentNOP-1;
		window.localStorage.setItem("numberOfPages", numberOfPages);
		$("#deletePageDialog").dialog("close");
	})

	document.querySelector("#noDontDeletePage").addEventListener("click", () => {
		$("#deletePageDialog").dialog("close");
	})



	/*Create random graphs functions*/
	//returns the coordinates of a new random vertex
	function computeRandomVertex(vertices, widthCanvas) {
		var randomPosX = Math.floor(Math.random() * widthCanvas);
		var randomPosY = Math.floor(Math.random() * widthCanvas);
		var randomVertex = {x:randomPosX, y:randomPosY};
		if(verticesNoCollision(vertices, randomVertex, widthCanvas)) {
			return randomVertex;
		}
		else {
			return computeRandomVertex(vertices, widthCanvas);
		}
	}


	//
	function computeRandomVertexWithProjection(vertices, widthCanvas){
		var n = widthCanvas;
		var vertex = computeRandomVertex(vertices, widthCanvas);
		var x = vertex.x;
		var y = vertex.y;

		//(x,y) is in the right half of the Triangle
		if ((x+y)<n) {
			return vertex;
		}
		//(x,y) is outside the triangle but inside the rectangle
		//so we need to project it into the left side of the triangle
		else if ((x+y)>n) {
			var d = n-x-y;
			//mirroring on the rectangles diagonal
			x = x+d;
			y = y+d;
			//mirroring on the central line of the triangle
			x = -x;
			vertex.x = x;
			vertex.y = y;
			if(!verticesNoCollision(vertices, vertex, widthCanvas)) {
				return computeRandomVertexWithProjection(vertices, widthCanvas);
			}
			else {
				return vertex;
			}
		}
		//don´t accept vertices on the boundary of the triangle
		else if ((x+y)==n) {
			return computeRandomVertexWithProjection(vertices, widthCanvas);
		} else {
			alert("There is some error");
		}
	}

	//
	function computeRandomYPointInTriangle(widthCanvas, nodeSize, listYPoints) {
		var arrayYPoints = listYPoints.toArray();
		var x, y, newYPoint;
		var bool = false;
		x = Math.floor(Math.random() * widthCanvas);
		y = Math.floor(Math.random() * widthCanvas);
		/* move the Points inside the triangle */
		//(x,y) is in the right half of the Triangle
		if ((x+y)<widthCanvas) {
			newYPoint = new yfiles.algorithms.YPoint(x,y);
			var collision = false;
			for (var i = 0; i < arrayYPoints.length; i++) {
				var vertexX = arrayYPoints[i].x;
				var vertexY = arrayYPoints[i].y;

				if(vertexX<=x && x<=(vertexX+nodeSize) && vertexY<=y && y<=(vertexY+nodeSize)
					|| (vertexX-nodeSize)<=x && x<=vertexX && vertexY<=y && y<=(vertexY+nodeSize)
					|| vertexX<=x && x<=(vertexX+nodeSize) && (vertexY-nodeSize)<=y && y<=vertexY
					|| (vertexX-nodeSize)<=x && x<=vertexX && (vertexY-nodeSize)<=y && y<=vertexY) {
						collision = true;
						break;
					}
			}
			if(collision) {
				return computeRandomYPointInTriangle(widthCanvas, nodeSize, listYPoints);
			}
			else {
				return newYPoint;
			}
		}
		//(x,y) is outside the triangle but inside the rectangle
		//so we need to project it into the left side of the triangle
		else if ((x+y)>widthCanvas) {
			var d = widthCanvas-x-y;
			//mirroring on the rectangles diagonal
			x = x+d;
			y = y+d;
			//mirroring on the central line of the triangle
			x = -x;
			newYPoint = new yfiles.algorithms.YPoint(x,y);
			var collision = false;
			for (var i = 0; i < arrayYPoints.length; i++) {
				var vertexX = arrayYPoints[i].x;
				var vertexY = arrayYPoints[i].y;

				if(vertexX<=x && x<=(vertexX+nodeSize) && vertexY<=y && y<=(vertexY+nodeSize)
					|| (vertexX-nodeSize)<=x && x<=vertexX && vertexY<=y && y<=(vertexY+nodeSize)
					|| vertexX<=x && x<=(vertexX+nodeSize) && (vertexY-nodeSize)<=y && y<=vertexY
					|| (vertexX-nodeSize)<=x && x<=vertexX && (vertexY-nodeSize)<=y && y<=vertexY) {
						collision = true;
						break;
					}
			}
			if(collision) {
				return computeRandomYPointInTriangle(widthCanvas, nodeSize, listYPoints);
			}
			else {
				return newYPoint;
			}
		}
		//don´t accept vertices on the boundary of the triangle
		else if ((x+y)==widthCanvas) {
			return computeRandomYPointInTriangle(widthCanvas, nodeSize, listYPoints);
		} else {
			alert("There is some error");
		}
	}


	//returns a structured view of bipartite vertices
	function computeBipartiteVertices(numberOfVerticesM, numberOfVerticesN) {
		var bipartiteVertices = [];
		var m = numberOfVerticesM;
		var mInt = parseInt(m);
		var n = numberOfVerticesN;
		for (var i = 0; i <= m-1; i++) {
			var posX = 0;
			var posY = 0+(60*i);
			var bipartiteVertex = {x:posX, y:posY};
			bipartiteVertices[i] = bipartiteVertex;
		}
		for (var j = 0; j <= n; j++) {
			var posX = 300;
			var posY = 0+(60*j);
			var bipartiteVertex = {x:posX, y:posY};
			bipartiteVertices[mInt+j] = bipartiteVertex;
		}
		return bipartiteVertices;
	}

	//checks if a given vertex does not collide with existing vertices
	function verticesNoCollision(vertices, vertex, widthCanvas) {
		var randomPosX = vertex.x;
		var randomPosY = vertex.y;
		var nodeSize = 30;
		var vLength = vertices.length;
		if(vLength == 0) {
			return true;
		}
		else {
			for (var i = 0; i <= vLength-1; i++) {
				var x = vertices[i].layout.x;
				var y = vertices[i].layout.y;
				if(x<=randomPosX && randomPosX<=(x+nodeSize) && y<=randomPosY && randomPosY<=(y+nodeSize)
					|| (x-nodeSize)<=randomPosX && randomPosX<=x && y<=randomPosY && randomPosY<=(y+nodeSize)
					|| x<=randomPosX && randomPosX<=(x+nodeSize) && (y-nodeSize)<=randomPosY && randomPosY<=y
					|| (x-nodeSize)<=randomPosX && randomPosX<=x && (y-nodeSize)<=randomPosY && randomPosY<=y) {
						return false;
					}
			}
		return true;
		}
	}

	//checks whether there is an existing edge between given source and target
	function edgeCollision(edges, node1, node2) {
		for (var i = 0; i < edges.length; i++) {
			var s = edges[i].sourceNode;
			var t = edges[i].targetNode;
			if(s == node1 && t == node2 || t == node1 && s == node2) {
				return true;
			}
		}
		return false;
	}

	//returns two random vertices: source and target for an edge
	function computeRandomVerticesForEdge(numberOfVertices, vertices) {
		var randomNr1 = Math.floor(Math.random() * numberOfVertices);
		var randomNr2 = Math.floor(Math.random() * numberOfVertices);
		var randomNode1 = vertices[randomNr1];
		var randomNode2 = vertices[randomNr2];
		var sourceAndTarget = [];
		sourceAndTarget[0] = randomNode1;
		sourceAndTarget[1] = randomNode2;
		return sourceAndTarget;
	}

	//controls that the source and target vertices are not the same and there is not already an existing edge
	//also controls that there are not more edges than possible (with single edges and without self-loops)
	function checkPossibleEdge(node1, node2, numberOfVertices, numberOfEdges, vertices, edges) {
		var maxEdgesGraph = (numberOfVertices*(numberOfVertices-1))/2;
		if (node1 == node2) {
			var sourceAndTarget = computeRandomVerticesForEdge(numberOfVertices, vertices);
			var node1 = sourceAndTarget[0];
			var node2 = sourceAndTarget[1];
			var sourceAndTarget = checkPossibleEdge(node1, node2, numberOfVertices, numberOfEdges, vertices, edges);
			return sourceAndTarget;
		}
		else if (edgeCollision(edges, node1, node2)) {
			var sourceAndTarget = computeRandomVerticesForEdge(numberOfVertices, vertices);
			var node1 = sourceAndTarget[0];
			var node2 = sourceAndTarget[1];
			var sourceAndTarget = checkPossibleEdge(node1, node2, numberOfVertices, numberOfEdges, vertices, edges);
			return sourceAndTarget;
		}
		else if (numberOfEdges>maxEdgesGraph) {
			graphComponent.graph.clear();
			//document.getElementById("graphType").selectedIndex = "0";
			$("#computeRandomDialog").dialog("open");
		}
		else {
			var sourceAndTarget = [];
			sourceAndTarget[0] = node1;
			sourceAndTarget[1] = node2;
			return sourceAndTarget;
		}
	}

	//computes an edge between to random vertices
	function computeRandomEdge(numberOfEdges, numberOfVertices, edges, vertices) {
		var sourceAndTarget = computeRandomVerticesForEdge(numberOfVertices, vertices);
		var randomNode1 = sourceAndTarget[0];
		var randomNode2 = sourceAndTarget[1];
		var sourceAndTarget = checkPossibleEdge(randomNode1, randomNode2, numberOfVertices,numberOfEdges, vertices, edges);
		return sourceAndTarget;
	}

	//chooses one possible face
	function getRandomFace(numberOfFaces, planarEmbedding, outerFace) {
		var random = Math.floor(Math.random() * numberOfFaces);
		var randomFace = planarEmbedding.faces.elementAt(random);
		if (randomFace==outerFace) {
			return getRandomFace(numberOfFaces, planarEmbedding, outerFace);
		} else {
			return randomFace;
		}
	}

	//shuffles an array
	function shuffle(array) {
		var j, x, i;
			for (i = array.length - 1; i > 0; i--) {
					j = Math.floor(Math.random() * (i + 1));
					x = array[i];
					array[i] = array[j];
					array[j] = x;
			}
		return array;
	}

	//build the outer start triangle
	function buildStartTriangle(widthCanvas, nodeSize, vertices, edges, allYPoints) {
		var vertexStartTriangle1 = {x:-widthCanvas, y:0};
		var x = vertexStartTriangle1.x;
		var y = vertexStartTriangle1.y;
		var newYPoint = new yfiles.algorithms.YPoint(x,y);
		allYPoints.push(newYPoint);
		var vertexStartTriangle2 = {x:widthCanvas, y:0};
		var x = vertexStartTriangle2.x;
		var y = vertexStartTriangle2.y;
		var newYPoint = new yfiles.algorithms.YPoint(x,y);
		allYPoints.push(newYPoint);
		var vertexStartTriangle3 = {x:0, y:widthCanvas};
		var x = vertexStartTriangle3.x;
		var y = vertexStartTriangle3.y;
		var newYPoint = new yfiles.algorithms.YPoint(x,y);
		allYPoints.push(newYPoint);
	}



	/*Different Types of random graphs*/

	function typeRandom() {
		var numberOfVertices = document.getElementById("numberOfVertices").value;
		var numberOfEdges = document.getElementById("numberOfEdges").value;
		//draw Vertices
		var nodeSize = 30;
		var widthCanvas = numberOfVertices*nodeSize;
		var vertices = [];
		var edges = [];
		for(var i = 0; i <= numberOfVertices-1; i++) {
			var newVertex = computeRandomVertex(vertices, widthCanvas);
			var x = newVertex.x;
			var y = newVertex.y;
			vertices[i] = graphComponent.graph.createNode({
				layout: new yfiles.geometry.Rect(x,y,nodeSize,nodeSize),
				tag: getNextTag()
			})
			graphComponent.graph.addLabel(vertices[i], getNextLabel("node").toString());
		}
		//draw edges
		for(var j=0; j<=numberOfEdges-1; j++) {
			var sourceAndTarget = computeRandomEdge(numberOfEdges, numberOfVertices, edges, vertices);
			var source = sourceAndTarget[0];
			var target = sourceAndTarget[1];
			edges[j] = graphComponent.graph.createEdge({
				source: source,
				target: target,
				tag: source.tag+"-"+target.tag
			})
			graphComponent.graph.addLabel(edges[j], getNextLabel("edge").toString());
		}
		graphComponent.morphLayout(new yfiles.organic.OrganicLayout());
		//zoom to see all vertices and edges
		graphComponent.fitGraphBounds();
	}

	function typePlanar() {
		var numberOfVertices = document.getElementById("numberOfVertices").value;
		var numberOfEdges = document.getElementById("numberOfEdges").value;
		var maxPlanar = (3*numberOfVertices)-6;
		var graph = graphComponent.graph;
		if (numberOfEdges <= maxPlanar) {
			typeMaximalPlanar();
			var numberOfEdgesGraph = graph.edges.size;
			var amountRemovingEdges = numberOfEdgesGraph - numberOfEdges;
			for (var i = amountRemovingEdges; i > 0; i--) {
				numberOfEdgesGraph = graph.edges.size;
				var random = Math.floor(Math.random() * numberOfEdgesGraph);
				var edgesList = graph.edges;
				var randomEdge = edgesList.elementAt(random);
				graph.remove(randomEdge);
			}
			var edgesListGraph = graph.edges;
			var edgesArrayGraph = edgesListGraph.toArray();
			for (var i = 0; i < edgesArrayGraph.length; i++) {
				var listLabels = edgesArrayGraph[i].labels;
				var l = listLabels.get(0);
				graph.remove(l);
				graph.addLabel(edgesArrayGraph[i], i.toString());
			}
		} else {
			alert("There is no possible planar graph with these properties!");
		}

		//zoom to see all vertices and edges
		graphComponent.fitGraphBounds();
	}

	function typePlanar3Tree() {
		var numberOfVertices = document.getElementById("numberOfVertices").value;
		var numberOfVerticesInt = parseInt(numberOfVertices);
		var numberOfEdges = (3*numberOfVerticesInt)-6;
		var nodeSize = 30;
		var sideOuterTriangle = numberOfVerticesInt*nodeSize*3;
		var halfSideOuterTriangle = sideOuterTriangle/2;
		var heightOuterTriangle = (Math.sqrt(3)/2)*sideOuterTriangle;
		var vertices = [];
		var edges = [];
		if (numberOfVertices <= 2) {
			typeTree();
		} else {
			//build the start triangle (equilateral triangle, so the height is (sqrt(2)/3)*side)
			var vertexStartTriangle1 = {x:0, y:0};
			var x = vertexStartTriangle1.x;
			var y = vertexStartTriangle1.y;
			vertices[0] = graphComponent.graph.createNode({
				layout: new yfiles.geometry.Rect(x,y,nodeSize,nodeSize),
				tag: getNextTag()
			})
			graphComponent.graph.addLabel(vertices[0], getNextLabel("node").toString());
			var vertexStartTriangle2 = {x:sideOuterTriangle, y:0};
			var x = vertexStartTriangle2.x;
			var y = vertexStartTriangle2.y;
			vertices[1] = graphComponent.graph.createNode({
				layout: new yfiles.geometry.Rect(x,y,nodeSize,nodeSize),
				tag: getNextTag()
			})
			graphComponent.graph.addLabel(vertices[1], getNextLabel("node").toString());
			var vertexStartTriangle3 = {x:halfSideOuterTriangle, y:heightOuterTriangle};
			var x = vertexStartTriangle3.x;
			var y = vertexStartTriangle3.y;
			vertices[2] = graphComponent.graph.createNode({
				layout: new yfiles.geometry.Rect(x,y,nodeSize,nodeSize),
				tag: getNextTag()
			})
			graphComponent.graph.addLabel(vertices[2], getNextLabel("node").toString());
			var source = vertices[0];
			var target = vertices[1];
			edges[0] = graphComponent.graph.createEdge({
				source: source,
				target: target,
				tag: source.tag+"-"+target.tag
			})
			graphComponent.graph.addLabel(edges[0], getNextLabel("edge").toString());
			var source = vertices[1];
			var target = vertices[2];
			edges[1] = graphComponent.graph.createEdge({
				source: source,
				target: target,
				tag: source.tag+"-"+target.tag
			})
			graphComponent.graph.addLabel(edges[1], getNextLabel("edge").toString());
			var source = vertices[2];
			var target = vertices[0];
			edges[2] = graphComponent.graph.createEdge({
				source: source,
				target: target,
				tag: source.tag+"-"+target.tag
			})
			graphComponent.graph.addLabel(edges[2], getNextLabel("edge").toString());


			//add every vertex randomly in one of the existing faces and connect it to every node at this face
			var leftVertices = numberOfVerticesInt-3;
			for (var i = 0; i < leftVertices; i++) {
			var adapter = new yfiles.layout.YGraphAdapter(graphComponent.graph);
			var ygraph = adapter.yGraph;
			var planarEmbedding = new yfiles.algorithms.PlanarEmbedding(ygraph);
			var outerFace = planarEmbedding.outerFace;
			var numberOfFaces = planarEmbedding.faces.size;

			var randomFace = getRandomFace(numberOfFaces, planarEmbedding, outerFace);

			var x = 0;
			var y = 0;

			vertices[i+3] = graphComponent.graph.createNode({
				layout: new yfiles.geometry.Rect(x,y,nodeSize,nodeSize),
				tag: getNextTag()
			});
			graphComponent.graph.addLabel(vertices[i+3], getNextLabel("node").toString());
			randomFace.forEach(dart => {
				var source =  adapter.getOriginalNode(dart.reversed ? dart.associatedEdge.source : dart.associatedEdge.target);
				//alert("round i: "+i+". source: "+source.toString());
				var e = graphComponent.graph.createEdge({
					source: source,
					target: vertices[i+3],
					tag: source.tag+"-(0)-"+vertices[i+3].tag
				});
				graphComponent.graph.addLabel(e, getNextLabel("edge").toString())
				x = x + source.layout.center.x;
				y = y + source.layout.center.y;
			});
				x = x / randomFace.size;
				y = y / randomFace.size;
				graphComponent.graph.setNodeCenter(vertices[i+3], new yfiles.geometry.Point(x, y));
			}
		}
		//zoom to see all vertices and edges
		graphComponent.fitGraphBounds();
	}

	function typeMaximalPlanar() {
		var numberOfVertices = document.getElementById("numberOfVertices").value;
		var nodeSize = 30;
		var widthCanvas = numberOfVertices*nodeSize;
		var vertices = []; //n
		var edges = []; //n*(n-1)/2
		var listYPoints = new yfiles.algorithms.YList();
		var graph = graphComponent.graph;
		var adapter = new yfiles.layout.YGraphAdapter(graph);
		var ygraph = adapter.yGraph;
		var nodeMap, edgeMap;
		var ynodes = new yfiles.algorithms.YList();
		var yedges = new yfiles.algorithms.YList();

		buildStartTriangle(widthCanvas, nodeSize, vertices, edges, listYPoints);

		//create List of YPoints and draw vertices with properties of the YPoints
		for(var i = 3; i <= numberOfVertices-1; i++) {
			var newYPoint = computeRandomYPointInTriangle(widthCanvas, nodeSize, listYPoints);
			listYPoints.push(newYPoint);
		}

		//initialize NodeMap and EdgeMap for triangulation
		nodeMap = ygraph.createNodeMap();
		edgeMap = ygraph.createEdgeMap();

		//calculate the triangulation with the given list of YPoints
		var triangulation = new yfiles.algorithms.Triangulator.triangulatePoints(listYPoints, ygraph, nodeMap, edgeMap);

		ynodes = ygraph.getNodeArray();
		yedges = ygraph.getEdgeArray();





		for (var i = 0; i <= ynodes.length-1; i++) {
			var ynode = nodeMap.get(ynodes[i]);
			var x = ynode.x;
			var y = ynode.y;
			vertices[i] = graphComponent.graph.createNode({
				layout: new yfiles.geometry.Rect(x,y,nodeSize,nodeSize),
				tag: getNextTag()
			})
			graphComponent.graph.addLabel(vertices[i], getNextLabel("node").toString());
		}

		for (var i = 0; i <= yedges.length-1; i++) {
			var boolCreateEdge = true;
			var yedge = edgeMap.get(yedges[i]);
			var ysource = yedge.source;
			var ytarget = yedge.target;
			var sourceIndex = ysource.index;
			var targetIndex = ytarget.index;
			var source = vertices[sourceIndex];
			var target = vertices[targetIndex];

			for (var j = 0; j <= edges.length-1; j++) {
				var sx = edges[j].sourceNode.layout.x;
				var sy = edges[j].sourceNode.layout.y;
				var tx = edges[j].targetNode.layout.x;
				var ty = edges[j].targetNode.layout.y;
				if (source.layout.x==tx && source.layout.y==ty && target.layout.x==sx && target.layout.y==sy) {
					boolCreateEdge = false;
				}
			}

			if (boolCreateEdge) {
				var edge = graphComponent.graph.createEdge({
					source: source,
					target: target,
					tag: source.tag+"-"+target.tag
				})
				graphComponent.graph.addLabel(edge, getNextLabel("edge").toString());
				edges.push(edge);
			}
		}

		graphComponent.fitGraphBounds();
	}

	function typeTree() {
		var numberOfVertices = document.getElementById("numberOfVertices").value;
		//draw Vertices
		var nodeSize = 30;
		var widthCanvas = numberOfVertices*nodeSize;
		var vertices = [];
		var edges = [];
		for(var i = 0; i <= numberOfVertices-1; i++) {
			var newVertex = computeRandomVertex(vertices, widthCanvas);
			var x = newVertex.x;
			var y = newVertex.y;
			vertices[i] = graphComponent.graph.createNode({
				layout: new yfiles.geometry.Rect(x,y,nodeSize,nodeSize),
				tag: getNextTag()
			})
			graphComponent.graph.addLabel(vertices[i], getNextLabel("node").toString());
			//if there is more than one vertex, create an edge to a random previous vertex
			if (i>=1) {
				var sourceAndTarget = computeRandomVerticesForEdge(i, vertices);
				var source = vertices[i];
				var target = sourceAndTarget[1];
				edges[i-1] = graphComponent.graph.createEdge({
					source: source,
					target: target,
					tag: source.tag+"-"+target.tag
				})
				graphComponent.graph.addLabel(edges[i-1], getNextLabel("edge").toString());
			}
		}
		graphComponent.morphLayout(new yfiles.tree.BalloonLayout());
		//zoom to see all vertices and edges
		graphComponent.fitGraphBounds();
	}

	function typeComplete() {
		var numberOfVertices = document.getElementById("numberOfVertices").value;
		//draw Vertices
		var nodeSize = 30;
		var widthCanvas = numberOfVertices*nodeSize;
		var vertices = [];
		var edges = [];
		for(var i = 0; i <= numberOfVertices-1; i++) {
			var newVertex = computeRandomVertex(vertices, widthCanvas);
			var x = newVertex.x;
			var y = newVertex.y;
			vertices[i] = graphComponent.graph.createNode({
				layout: new yfiles.geometry.Rect(x,y,nodeSize,nodeSize),
				tag: getNextTag()
			})
			graphComponent.graph.addLabel(vertices[i], getNextLabel("node").toString());
			for (var j = 0; j <= i-1; j++) {
				var source = vertices[i];
				var target = vertices[j];
				edges[j] = graphComponent.graph.createEdge({
					source: source,
					target: target,
					tag: source.tag+"-"+target.tag
				})
				graphComponent.graph.addLabel(edges[j], getNextLabel("edge").toString());
			}
		}
		graphComponent.morphLayout(new yfiles.circular.CircularLayout());
		//zoom to see all vertices and edges
		graphComponent.fitGraphBounds();
	}

	function typeCompleteBipartite() {
		//get structured vertices
		var nodeSize = 30;
		var vertices = [];
		var edges = [];
		var m = document.getElementById("numberOfBipartiteVerticesM").value;
		var n = document.getElementById("numberOfBipartiteVerticesN").value;
		var mInt = parseInt(m);
		var nInt = parseInt(n);
		var numberOfVertices = mInt+nInt;
		vertices = computeBipartiteVertices(m, n);
		//draw vertices
		for (var i = 0; i < numberOfVertices; i++) {
			var x = vertices[i].x;
			var y = vertices[i].y;
			vertices[i] = graphComponent.graph.createNode({
				layout: new yfiles.geometry.Rect(x,y,nodeSize,nodeSize),
				tag: getNextTag()
			})
			graphComponent.graph.addLabel(vertices[i], getNextLabel("node").toString());
		}
		//draw edges
		if (mInt < nInt) {
			for (var j = 0; j <= n-1; j++) {
				for (var k = 0; k <= m-1; k++) {
					var source = vertices[mInt+j];
					var target = vertices[k];
					edges[j+k] = graphComponent.graph.createEdge({
						source: source,
						target: target,
						tag: source.tag+"-"+target.tag
					})
					graphComponent.graph.addLabel(edges[j+k], getNextLabel("edge").toString());
				}
			}
		} else {
			for (var j = 0; j <= m-1; j++) {
				for (var k = 0; k <= n-1; k++) {
					var source = vertices[j];
					var target = vertices[mInt+k];
					edges[j+k] = graphComponent.graph.createEdge({
						source: source,
						target: target,
						tag: source.tag+"-"+target.tag
					})
					graphComponent.graph.addLabel(edges[j+k], getNextLabel("edge").toString());
				}
			}
		}
		//zoom to see all vertices and edges
		graphComponent.fitGraphBounds();
	}


	//Select the right type of graph
	function computeRandomGraph() {
		var graphType = document.getElementById("graphType").value;
		switch (graphType) {
			case "random":
				typeRandom();
				break;
			case "planar":
				typePlanar();
				break;
			case "planar3Tree":
				typePlanar3Tree();
				break;
			case "maximalPlanar":
				typeMaximalPlanar();
				break;
			case "tree":
				typeTree();
				break;
			case "complete":
				typeComplete();
				break;
			case "completeBipartite":
				typeCompleteBipartite();
				break;
		}
	}

	/*
	 * This function stellates an edge, meaning that it places a node somewhere above or below the edge and connects source and target of the edge with two new edges
	 */

	// TODO change edge tags here DONE

	function stellateEdge(e) {
		var xsourceNode = e.sourceNode.layout.center.x
		var xtargetNode = e.targetNode.layout.center.x
		var ysourceNode = e.sourceNode.layout.center.y
		var ytargetNode = e.targetNode.layout.center.y


		var xnew = xsourceNode + 0.5 * (xtargetNode - xsourceNode)
		var ynew = ysourceNode + 0.5 * (ytargetNode - ysourceNode)

		var width = e.sourceNode.layout.width
		var height = e.sourceNode.layout.height

		var newNode = graphComponent.graph.createNodeAt(new yfiles.geometry.Point(xnew + 30, ynew + 30))
		var edge1 = graphComponent.graph.createEdge(newNode, e.sourceNode)
		var edge2 = graphComponent.graph.createEdge(newNode, e.targetNode)

		// adding labels and tags
		var nodeLabel = getNextLabel("node");
		graphComponent.graph.addLabel(newNode, nodeLabel.toString())
		newNode.tag = getNextTag();

		var edge1Label = getNextLabel("edge");
		graphComponent.graph.addLabel(edge1, edge1Label.toString())
		edge1.tag = edge1.sourceNode.tag + "-(0)-" + edge1.targetNode.tag

		var edge2Label = getNextLabel("edge");
		graphComponent.graph.addLabel(edge2, edge2Label.toString())
		edge2.tag = edge2.sourceNode.tag + "-(0)-" + edge2.targetNode.tag
	}

	/*
	 * iterates over the whole graph and resets every edge to polyline-stlye (black, straight line)
	 */

	function resetToPolylineStyle() {
		graphComponent.graph.edges.forEach(edge => {
			graphComponent.graph.setStyle(edge, new yfiles.styles.PolylineEdgeStyle())
		})
	}

	function resetToPolylineStyleWithArrow(color) {
		graphComponent.graph.edges.forEach(edge => {
			graphComponent.graph.setStyle(edge, new yfiles.styles.PolylineEdgeStyle({
				targetArrow: yfiles.styles.IArrow.DEFAULT
			}
			))
		})
	}

	function resetDefaultEdgesStyle(needArrow, color) {
		if (needArrow) {
			graphComponent.graph.edgeDefaults.style = new yfiles.styles.PolylineEdgeStyle({
				targetArrow: yfiles.styles.IArrow.DEFAULT
			})
			resetToPolylineStyleWithArrow(color);
		}
		else {
			graphComponent.graph.edgeDefaults.style = new yfiles.styles.PolylineEdgeStyle({
				targetArrow: yfiles.styles.IArrow.NONE
			})
			resetToPolylineStyle();
		}
	}

	/*
	 *  Sends the data created by "createDataForCalculation" to the current (!) server and forwards the user to the view page
	 */

	function computeLinearLayout() {
		var graph;
		var responseID = -1;

		graphMLIOHandler
			.write(graphComponent.graph)
			.then(result => graph = result);

		setTimeout(function () {

			var graphEncoded64 = btoa(graph);

			var data = JSON.stringify(createDataForCalculation(graphEncoded64))

			var currentServer = window.localStorage.getItem("currentServer")

			if (currentServer == null) {
				currentServer = standardServer;
			} else {
				currentServer = currentServer + "/embeddings"
			}

			var settings = {
				//"async": true,
				"crossDomain": true,
				"url": currentServer + "?async=true",
				"method": "POST",
				"headers": {
					"content-type": "application/json"
				},
				"success": function (response, status) {
					redirection(response.id)
				},
				"processData": false,
				"error": function (jqXHR) {
					$("#errorMessage").html("error: " + jqXHR.responseJSON.message)
					$("#wentWrong").dialog("open")
				},
				"data": data
			}


			$.ajax(settings);

		}, 2)

	}

	function redirection(id) {
		location.href = "linearlayout.html#" + id
	}

	/*
	 * creates the "data"-element that is needed by the ajax function
	 */

	// TODO ARE ALL THE CONSTRAINT IN THERE???
	function createDataForCalculation(graph) {

		var constraints = []
		constraintsArray.forEach(function (c) {

			if (c.type == "EDGES_ON_PAGES" || c.type == "EDGES_ON_PAGES_INCIDENT_NODE") {

				var constraintArguments = []
				c.getObjects()[0].forEach(function (o) {
					constraintArguments.push(o.tag.toString())
				})
				var constr = {
					"arguments": constraintArguments,
					"modifier": c.getObjects()[1],
					"type": c.getType()
				}
			} else if (c.type == "NODES_PREDECESSOR") {
				var constr = {
					"arguments": [c.getObjects()[0].tag.toString()],
					"modifier": [c.getObjects()[1].tag.toString()],
					"type": c.getType()
				}

			} else if (c.type == "EDGES_FROM_NODES_ON_PAGES") {
				var constraintArguments = []
				c.getObjects()[0].forEach(function (o) {
					constraintArguments.push(o.tag.toString())
				})
				var modifiers = []
				c.getObjects()[1].forEach(function (m) {
					modifiers.push(m.toString())
				})
				var constr = {
					"arguments": constraintArguments,
					"modifier": modifiers,
					"type": c.getType()
				}
			} else if (c.type == "EDGES_TO_SUB_ARC_ON_PAGES") {
				var constraintArguments = []
				c.getObjects()[0].forEach(function (o) {
					constraintArguments.push(o.tag.toString())
				})

				var modifiers = []
				c.getObjects()[1].forEach(function (m) {
					modifiers.push(m.toString())
				})
				var constr = {
					"type": c.getType(),
					"arguments": constraintArguments,
					"modifier": modifiers,
				}
			} else {
				var constraintArguments = []
				c.getObjects().forEach(function (o) {
					constraintArguments.push(o.tag.toString())
				})
				var constr = {
					"type": c.getType(),
					"arguments": constraintArguments,
					"modifier": [],
				}
			}
			constraints.push(constr)
		})

		var pages = []
		var avPages = getAvailablePages();
		avPages.forEach(function (p) {
			var page = {
				"constraint": $("#layoutP" + p).val(),
				"type": $("#typeP" + p).val(),
				"id": "P" + p
			}
			pages.push(page)
		})

		var data = {
			"constraints": constraints,
			"graph": graph,
			"pages": pages

		}

		return data;
	}

	/*
	 * After a redirection to #ll+id this function interprets the graph as a linear layout
	 */

	function interpretResultAsLinearLayout(object) {

		// arranges the nodes according to the calculated linear layout
		var orderedNodes = object.vertex_order
		var nodes = graphComponent.graph.nodes.toArray()

		var position = 0;

		orderedNodes.forEach(function (n) {
			nodes.forEach(function (gn) {

				if (gn.tag.toString() == n) {
					var height = gn.layout.height;
					var width = gn.layout.width;
					graphComponent.graph.setNodeLayout(gn, new yfiles.geometry.Rect(position, 0, width, height))

				}

			})
			position = position + 200;

		})

		// rearranging the edges if necessary to have the arcs of the linear layout in the right orientation (swapping source and target if necessary)

		var edges = graphComponent.graph.edges.toArray()
		edges.forEach(function (e) {

			// correcting the ports if necessary
			graphComponent.graph.setPortLocation(e.sourcePort, e.sourceNode.layout.center)
			graphComponent.graph.setPortLocation(e.targetPort, e.targetNode.layout.center)

			// swapping source and target of edge in order to make them all go in the right direction if necessary
			if (orderedNodes.indexOf(e.sourceNode.tag.toString()) > orderedNodes.indexOf(e.targetNode.tag.toString())) {
				var newEdge = graphComponent.graph.createEdge({
					source: e.targetNode,
					target: e.sourceNode,
					tag: e.tag
				})

				// assign label of old edge to new edge
				var oldLabel = e.labels.toArray()[0].text
				var newLabel = graphComponent.graph.addLabel(newEdge, oldLabel)


				const edgeSegmentLabelModelx = new yfiles.graph.EdgeSegmentLabelModel()
				edgeSegmentLabelModelx.offset = 10
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

		// registering which edges go on which pages
		var assignments = object.assignments

		assignments.forEach(function (a) {
			var arrayLocation = a.page.slice(1)
			arrayLocation = arrayLocation - 1;

			// TODO change tags here NOT NECESSARY

			var edges = graphComponent.graph.edges.toArray()
			edges.forEach(function (e) {
				var reversestring = a.edge.split("-").reverse().join("-");

				if (a.edge == e.tag.toString()) {
					pagesArray[arrayLocation].push(e)
				} else if (reversestring == e.tag.toString()) {
					pagesArray[arrayLocation].push(e)
				}
			})
		})

		// assigns the colors to the edges for easier observation

		//			var colors = ["#FF0000", "#0000FF", "#00FF00", "#000000"]
		let i;
		for (i = 0; i < numberOfPages; i++) {
			pagesArray[i].forEach(function (e) {
				if (i % 2 != 0) {
					if (treatEdgesAsDirected) {
						graphComponent.graph.setStyle(e, createArcStyleWithArrows(getArcHeight(e), colors[i]))
					}
					else {
						graphComponent.graph.setStyle(e, createArcStyle(getArcHeight(e), colors[i]))
					}
				} else {
					if (treatEdgesAsDirected) {
						graphComponent.graph.setStyle(e, createArcStyleWithArrows(-getArcHeight(e), colors[i]))
					}
					else {
						graphComponent.graph.setStyle(e, createArcStyle(-getArcHeight(e), colors[i]))
					}
				}
			})
		}


		// interpret constraints
		loadConstraintsFromJSON(object.constraints)

		// updates the pages with constraints
		var pages = object.pages
		pages.forEach(function (p) {
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


			$("#page" + (parseInt(id) + 1)).checkboxradio({
				disabled: false
			})

		})

		graphComponent.fitGraphBounds();
	}

	/*
	 * creates the Arc Edge Style for a linear layout
	 */
	function createArcStyle(height, color) {
		return new yfiles.styles.ArcEdgeStyle({
			height: height,
			stroke: color
		})
	}


	function createArcStyleWithArrows(height, color) {
		console.log("Mai aaya idhar")
		console.log(color)
		const targetArrowStyle = new yfiles.styles.Arrow({
			type: yfiles.styles.ArrowType.DEFAULT,
			stroke: color,
			fill: color
		})
		return new yfiles.styles.ArcEdgeStyle({
			height: height,
			stroke: color,
			targetArrow: targetArrowStyle
		})
	}

	/*
	 * calculates individual arc height for each edge
	 */
	function getArcHeight(edge) {
		const source = edge.sourceNode.layout.center
		const target = edge.targetNode.layout.center

		const distance = source.distanceTo(target)

		return Math.abs(distance / 5)
	}

	/*
	 * After a redirection to #or+id this function displays the graph and registers constraints etc.
	 */
	function interpretResultAsRegularLayout(object) {
		graphComponent.fitGraphBounds();

		// load in the constraints and pages
		loadConstraintsFromJSON(object.constraints)

		// updates pages and page constraints
		var pages = object.pages
		pages.forEach(function (p) {
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


			$("#page" + (parseInt(id) + 1)).checkboxradio({
				disabled: false
			})
		})


		// Show colors of linear layout for easier observation
		if (object.assignments != null) {
			setTimeout(function () {
				var assignments = object.assignments

				assignments.forEach(function (a) {
					var arrayLocation = a.page.slice(1)
					arrayLocation = arrayLocation - 1;

					var edges = graphComponent.graph.edges.toArray()
					edges.forEach(function (e) {
						if (a.edge == e.tag.toString()) {
							pagesArray[arrayLocation].push(e)
						}
					})
				})



				//var colors = ["#FF0000", "#0000FF", "#00FF00", "#000000"]
				let i;
				for (i = 0; i < numberOfPages; i++) {
					if (treatEdgesAsDirected) {
						pagesArray[i].forEach(function (e) {
							const targetArrowStyle = new yfiles.styles.Arrow({
								type: yfiles.styles.ArrowType.DEFAULT,
								stroke: colors[i],
								fill: colors[i]
							})
							var polyStyle = new yfiles.styles.PolylineEdgeStyle({
								stroke: colors[i],
								targetArrow: targetArrowStyle //yfiles.styles.IArrow.DEFAULT,
								//                                targetArrow: true
							})

							graphComponent.graph.setStyle(e, polyStyle)
						})
					}
					else {
						pagesArray[i].forEach(function (e) {
							var polyStyle = new yfiles.styles.PolylineEdgeStyle({
								stroke: colors[i],
								targetArrow: yfiles.styles.IArrow.NONE
							})

							graphComponent.graph.setStyle(e, polyStyle)
						})
					}

				}
			}, 20)

		}
	}
	// translates constraints in json to constraints usable by the gui
	function loadConstraintsFromJSON(constraints) {
		constraints.forEach(function (c) {

			switch (c.type) {
				case "NODES_PREDECESSOR":
					var objItems = []

					// for all arguments search through all nodes to connect them to the constraint
					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})

					// for all modifiers do the same
					c.modifier.forEach(function (m) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == m) {
								objItems.push(n)
							}
						})
					})

					var con = new Predecessor(objItems)
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;

				case "TREAT_GRAPH_DIRECTED":

					treatEdgesAsDirected = false;
					document.getElementById('directedEdges').click();
					window.sessionStorage.setItem("directedEdgesStatus", document.getElementById('directedEdges').checked);

					break;

				case "NODES_CONSECUTIVE":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})

					var con = new Consecutive(objItems)
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "NODES_SET_FIRST":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})

					var con = new SetAsFirst(objItems)
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "EDGES_SAME_PAGES_INCIDENT_NODE":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})

					var con = new SamePageForIncidentEdgesOf(objItems)
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "EDGES_DIFFERENT_PAGES_INCIDENT_NODE":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})

					var con = new DifferentPagesForIncidentEdgesOf(objItems)
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "NODES_SET_LAST":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})

					var con = new SetAsLast(objItems)
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "EDGES_SAME_PAGES":
					var objItems = [];

					c.arguments.forEach(function (a) {
						graphComponent.graph.edges.toArray().forEach(function (e) {
							if (e.tag == a) {
								objItems.push(e)
							}
						})
					})

					var con = new SamePage(objItems)
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "EDGES_DIFFERENT_PAGES":
					var objItems = [];

					c.arguments.forEach(function (a) {
						graphComponent.graph.edges.toArray().forEach(function (e) {
							if (e.tag == a) {
								objItems.push(e)
							}
						})
					})

					var con = new DifferentPages(objItems)
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "NOT_ALL_IN_SAME_PAGE":
					var objItems = [];

					c.arguments.forEach(function (a) {
						graphComponent.graph.edges.toArray().forEach(function (e) {
							if (e.tag == a) {
								objItems.push(e)
							}
						})
					})

					var con = new NotAllInSamePage(objItems)
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "EDGES_ON_PAGES":

					var objItems = [];

					c.arguments.forEach(function (a) {
						graphComponent.graph.edges.toArray().forEach(function (e) {
							if (e.tag == a) {
								objItems.push(e)
							}
						})
					})

					var con = new AssignedTo([objItems, c.modifier])
					constraintsArray.push(con);
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "NODES_REQUIRE_PARTIAL_ORDER":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})

					var con = new RequirePartialOrder(objItems);
					constraintsArray.push(con)
					$("#constraintTags").tagit("createTag", con.getPrintable())
					break;
				case "NODES_FORBID_PARTIAL_ORDER":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})

					var con = new ForbidPartialOrder(objItems);
					constraintsArray.push(con)
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "EDGES_FROM_NODES_ON_PAGES":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})
					var con = new RestrictEdgesFrom([objItems, c.modifier])
					constraintsArray.push(con)
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "EDGES_ON_PAGES_INCIDENT_NODE":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})
					var con = new IncidentEdgesOfVertexTo([objItems, c.modifier])
					constraintsArray.push(con)
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
				case "EDGES_TO_SUB_ARC_ON_PAGES":
					var objItems = []

					c.arguments.forEach(function (a) {
						graphComponent.graph.nodes.toArray().forEach(function (n) {
							if (n.tag == a) {
								objItems.push(n)
							}
						})
					})


					var con = new RestrictEdgesToArc([objItems, c.modifier])
					constraintsArray.push(con)
					$("#constraintTags").tagit("createTag", con.getPrintable())

					break;
			}
		})
	}

	// run main method
	run()
})
