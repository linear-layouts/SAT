/**
 * 
 */


function registerDisplaying() {
	let i;
	for (i = 1; i<= chosenPages; i++) {
		console.log(i)
		console.log($("#colorP" + i).val())
		console.log($("#placingP" + i).val())
	}
}

$( function() { 
	
	$( document ).tooltip();

	setTimeout(function() {
		var screenHeight = $(window).outerHeight()
		var displayHeight = $("#settings").outerHeight()
		var toolbarHeight = $(".toolbar").outerHeight()
		$("#graphComponent").height(screenHeight - (displayHeight +toolbarHeight + 35))

	},200)

	$("#file").hide()
	$("#view").hide()
	$("#layout").hide()
	$("#greyDiv").hide()


	$("#fileSettings").click(function() {
		$("#file").fadeToggle();
		$("#view").hide();
		$("#layout").hide();
	})

	$("#viewSettings").click(function() {
		$("#view").fadeToggle();
		$("#file").hide();
		$("#layout").hide();
	})

	$("#layoutSettings").click(function() {
		$("#layout").fadeToggle();
		$("#file").hide();
		$("#view").hide();
	})


	$( "#progressbar" ).progressbar({
		value: false
	});


	$("#constraintTags").tagit({
		readOnly: true, 
		allowDuplicates: true,

	});
	
	$("#ProgressDialog").dialog({
		autoOpen: true,
		resizable: false, 
		width: 400, 
	})
	
	$("#failedComputationDialog").dialog({
		autoOpen: false,
		resizable: false,
		width: 400,
	})

$("#cancelledNotificationDialog").dialog({
		autoOpen: false,
		resizable: false,
		width: 400,
	})

	$("#EditDialog").dialog({
		autoOpen: false,
		resizable: false,
		width: 230,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function(event, ui) {
			$("#greyDiv").hide()
		}
	})


	$("#exportDialog").dialog( {
		autoOpen: false,
		resizable: false,
		width: 230,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function(event, ui) {
			$("#greyDiv").hide()
		}
	});

	$("#errorDialog").dialog({
		autoOpen: false,
		resizable: false,
		width: 400,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function(event, ui) {
			$("#greyDiv").hide()
		}
	})
	$("#noIDDialog").dialog({
		autoOpen: false,
		resizable: false,
		width: 400,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function(event, ui) {
			$("#greyDiv").hide()
		}
	})
	
	$("#notSatisfiableDialog").dialog({
		autoOpen: false,
		resizable: false,
		width: 400,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function(event, ui) {
			$("#greyDiv").hide()
		}
	})
	
	$("#statsDialog").dialog({
		width: 'auto',
		resizable: false,
		autoOpen: false,
		modal: true,open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui) {
			$("#greyDiv").hide()

			$("#nrOfVertices").empty()
			$("#nrOfEdges").empty()
			$("#isPlanar").empty()
			$("#isConnected").empty()
			$("#isAcyclic").empty()
			$("#isTree").empty()
			$("#isBipartite").empty()
			$("#maxDegree").empty()
			$("#minDegree").empty()
		}
	})
	
	$("#nodeNeighborhood").dialog({
		width: 300,
		autoOpen: false,
		resizable: false,
		position: { my: "left center", at: "left center-25%", of: window }
	})
	
	$("#nodeNeighborhoodView").click(function() {
		$("#nodeNeighborhood").dialog("open")
	})
	$("#closeNodeNeighborhood").click(function() {
		$("#nodeNeighborhood").dialog("close")
	})
	
		$("#edgeNeighborhood").dialog({
		width: 300,
		autoOpen: false,
		resizable: false,
		position: { my: "left center", at: "left center", of: window }
	})
	
	$("#edgeNeighborhoodView").click(function() {
		$("#edgeNeighborhood").dialog("open")
	})
	$("#closeEdgeNeighborhood").click(function() {
		$("#edgeNeighborhood").dialog("close")
	})
	
	
		$("#saveDialog").dialog({
		modal: true,
		width: 250, 
		height: 200,
		resizable: false,
		autoOpen: false,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#fileName").val('');
			$("#greyDiv").hide();
		}
	})
	
	$("#aboutDialog").dialog({
		autoOpen: false,
		width: 700, 
		resizable: false,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function(event, ui) {
			$("#greyDiv").hide()
		}
	})

	$("#about").click(function(){
		$("#aboutDialog").dialog("open")
	})




	$("#displaySettings").click(function(){
		$("#settings").fadeToggle({
			duration: 'fast'
		});		

		setTimeout(function() {
			if ($("#settings").is(":visible")) {
				var screenHeight = $(window).outerHeight()
				var displayHeight = $("#display").outerHeight()
				var toolbarHeight = $(".toolbar").outerHeight()
				$("#graphComponent").height(screenHeight - (displayHeight + toolbarHeight + 35))
			} 

			if ($("#settings").is(":hidden")) {
				var screenHeight = $(window).outerHeight()
				var pagesHeight = $("#display").outerHeight()
				var toolbarHeight = $(".toolbar").outerHeight()
				$("#graphComponent").height(screenHeight - (toolbarHeight + 10))
				
			}	
		}, 250)

	});



})