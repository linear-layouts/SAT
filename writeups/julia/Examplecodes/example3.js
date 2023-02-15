// a JavaScript object literal
var graph = {
	nodes: 11,
	edges: 27,
};

// adding an event listener to a button that is triggered by hovering
document.getElementById("button").addEventListener("mouseover", function() {
	// when hovered over the button gets a red frame
	document.getElementById("button").style.border = "1px solid red";
})

// adding an event listener to a button that is triggered by click
document.getElementById("button").addEventListener("click", function() {
	// when the button is clicked, a notification shows up 
	var string = 	"This graph has " + graph.nodes.toString() +
					" nodes and " + graph.edges.toString() + " edges";
	alert(string);
})


