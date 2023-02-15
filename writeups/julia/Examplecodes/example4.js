var graph = {
	nodes: 11,
	edges: 27,
};

// adding an event listener to a button that is triggered by hovering
$("#button").click(function() {
	$("#button").style.border = "1px solid red";
})

// adding an event listener to a button that is triggered by click
$("#button").click(function() {
	var string = 	"This graph has " + graph.nodes.toString() +
					" nodes and " + graph.edges.toString() + " edges";
	alert(string);
})


