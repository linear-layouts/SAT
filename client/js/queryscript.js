let temp;

let x = 0;

function fillPages() {
	let j;

	for(j=2; j<=numberOfPages; j++) {
			$("#pages").append(

					'<div class="pagesSettings">'+
					'<label for="page'+j+'" id="labelP'+j+'">Page '+j+'</label> <input type="checkbox"'+
					'name="page'+j+'" id="page'+j+'"  onclick="handlePageCheckbox('+j+')" > <select id="typeP'+j+'" name="typeP'+j+'">'+
					'<option value="STACK">stack</option>'+
					'<option value="QUEUE">queue</option>'+
					'<option value="RIQUE">rique</option>'+
					'<option value="DEQUE">deque</option>'+
					//'<option value="MONQUE">monque</option>'+
					'<option value="NONE">undefined</option>' +
					'</select> <select id="layoutP'+j+'" name="layoutP'+j+'">'+
					'<option value="NONE">maximal</option>'+
					'<option value="FOREST">forest</option>'+
					'<option value="TREE">tree</option>'+
					'<option value="DISPERSIBLE">matching</option>'+
					'</select>'+
					'</div>'
			)



		$("#page"+j).checkboxradio({
			disabled: false,
			width: 150
		})

		$( "#typeP" + j ).selectmenu({
			disabled:true,
			position: { my : "top left", at: "top center" },
			width: 120
		});

		$( "#layoutP" + j ).selectmenu({
			disabled:true,
			position: { my : "top left", at: "top center" },
			width: 120
		});


		if ($(window).outerWidth() < 1200) {
			$("#page"+j).checkboxradio({
				width: 70,
				label: " "
			})
			$("#typeP"+j).selectmenu("option", "width", "70")
			$("#layoutP"+j).selectmenu("option", "width", "70")
		}

	}
}

function disablePages() {
	var checkedPages = 0;
	var numberOfPages = parseInt(window.localStorage.getItem("numberOfPages"));
	for (var j = 1; j <= numberOfPages; j++) {
		if (document.getElementById("page"+j).checked) {
			//checkedPages += 1;
			$("#page" + j).checkboxradio({
				disabled: false
			})
			var k = j+1;
			if (k <= numberOfPages) {
				$("#page" + k).checkboxradio({
					disabled: false
				})
			}
		} else {
			var s = j+1;
			if (s <= numberOfPages) {
				$("#page" + s).checkboxradio({
					disabled: true
				})
			}
		}
	}
}



function findRelatedConstraints(name) {
	var tags = $("#constraintTags").tagit("assignedTags");


	var tagsToDelete = [];

	let i;
	for (i = 0; i< tags.length; i++) {
		//alert("searched for " + name + " in " + tags[i] + " found at " + tags[i].search(name))
		if (tags[i].search(name) >-1) {
			tagsToDelete.push(tags[i])
		}
	}



	return tagsToDelete;
}


function findRelatedConstraintsDeluxeByIndex(item) {
	var arr = constraintsArray;

	var constrToDelete = []
	var constrIndexes = []
    var index = 0

	arr.forEach(function(constr) {
		if (constr.getObjects().includes(item)) {
			constrToDelete.push(constr)
            constrIndexes.push(index)

		} else if (Array.isArray(constr.objects[0])) {
			let i;
			for(i=0; i<constr.getObjects().length; i++) {
				if (constr.objects[i].includes(item)) {
					constrToDelete.push(constr)
                    constrIndexes.push(index)

				}
			}
		}
		index = index + 1
	})
	return constrIndexes
}


function findRelatedConstraintsDeluxe(item) {
	var arr = constraintsArray;

	var constrToDelete = []

	arr.forEach(function(constr) {
		if (constr.getObjects().includes(item)) {
			constrToDelete.push(constr)
		} else if (Array.isArray(constr.objects[0])) {
			let i;
			for(i=0; i<constr.getObjects().length; i++) {
				if (constr.objects[i].includes(item)) {
					constrToDelete.push(constr)
				}
			}
		}
	})

	return constrToDelete;
}

function findRelatedConstraintsPages(k) {
	var pgs = getAvailablePages()

	var tagsAll = [];

	pgs.forEach(function(p) {
		tagsAll = tagsAll.concat(findRelatedConstraints("p" + p))
	})

	return tagsAll;

}

function deleteRelatedConstraints(name) {
	var tags = $("#constraintTags").tagit("assignedTags");


	var tagsToDelete = [];

	let i;
	for (i = 0; i< tags.length; i++) {
		//alert("searched for " + name + " in " + tags[i] + " found at " + tags[i].search(name))
		if (tags[i].search(name) >-1) {
			tagsToDelete.push(tags[i])
		}
	}

	let j;
	for (j=0; j< tagsToDelete.length; j++) {
		$("#constraintTags").tagit("removeTagByLabel", tagsToDelete[j])
	}

}

function deleteRelatedConstraintsDeluxe(item) {
	var arr = constraintsArray;

	var constrToDelete = []
    var constrIndexToDelete = []
    var index = 0
	arr.forEach(function(constr) {
		if (constr.objects.includes(item) && constr.type != "TREAT_GRAPH_DIRECTED") {
			constrToDelete.push(constr)
			constrIndexToDelete.push(index)
		} else if (Array.isArray(constr.objects[0])) {
			let i;
			for(i=0; i<constr.objects.length; i++) {
				if (constr.objects[i].includes(item) && constr.type != "TREAT_GRAPH_DIRECTED") {
					constrToDelete.push(constr)
					constrIndexToDelete.push(index)
				}
			}
		}
		index = index + 1
	})

    let p;
    for(p=0; p<constrIndexToDelete.length; p++){
        constrIndexToDelete[p] = constrIndexToDelete[p] - p
    }

    let q;
    for(q=0; q<constrIndexToDelete.length; q++){
        var k = constrIndexToDelete[q]
        var temp1 = constraintsArray.slice(0,k)
        var temp2 = constraintsArray.slice(k+1, constraintsArray.length)
        constraintsArray = temp1.concat(temp2)
    }

    // remove ui constraints
    constrIndexToDelete.forEach(function(j) {
        $("#constraintTags").tagit("instance").tagList.children("li").toArray()[j].remove()
        //$("#constraintTags").tagit("removeTagByIndex", j, true)
    })


    //constrToDelete.forEach(function(constr){
	//	$("#constraintTags").tagit("removeTagByLabel", constr.getPrintable())
	//})
}

function deleteAllConstraints() {
	$("#constraintTags").tagit("removeAll");

}


function deselectPage(k) {
	$("#page" + k).prop("checked", false);
	$("#page" + k).button("refresh");

	$("#typeP" + k).selectmenu({
		disabled: true
	})
	$("#layoutP" + k).selectmenu({
		disabled: true
	})
}

function disableFollowingPages(k) {
	let j;
	for (j=k+1; j<= numberOfPages; j++) {

		deselectPage(j);

		$("#page" + j).checkboxradio({
			disabled: true
		})

	}
}

function getAvailablePages() {
	var avPages = [1];

	let k;
	for(k=2; k<=numberOfPages; k++) {
		if ($("#page" + k).prop("checked")) {
			avPages.push(k);
		}
	}

	return avPages;

}

function handlePageCheckbox(k) {
	if ($("#page" + k).prop("checked")) {
		$("#typeP" + k).selectmenu({
			disabled: false
		})
		$("#layoutP" + k).selectmenu({
			disabled: false
		})
		$("#page" + (k+1)).checkboxradio({
			disabled: false
		})
	} else if (!$("#page" + k).prop("checked")) {
		if (findRelatedConstraints("p" + k).length > 0 ) {
			temp = k
			$("#unselectPagesDialog").dialog("open")
		} else if (findRelatedConstraintsPages(k).length > 0){
			temp = k;
			$("#unselectPagesDialog").dialog("open")
		} else {
			$("#typeP" + k).selectmenu({
				disabled: true
			})
			$("#layoutP" + k).selectmenu({
				disabled: true
			})
			disableFollowingPages(k);

		}
	}


}



function fillAssignDialogForNodes(graphComponent) {
	var avPages = [1];

	let k;
	for(k=2; k<=numberOfPages; k++) {
		if ($("#page" + k).prop("checked")) {
			avPages.push(k);
		}
	}

	avPages.forEach( function(i) {
		$("#pageDialog").append(
				'<input type="checkbox" id="assignToPage'+i+'"> <label for="assignToPage'+i+'">Page '+i+'</label><br>'
		)
		$("#assignToPage"+i).checkboxradio();
	})


	$("#pageDialog").append('<button id="assignPages" class="ui-button ui-widget ui-corner-all">Assign</button>')



	$("#assignPages").click(function() {

		var selPages = [];
		let k;
		for (k=1; k<=numberOfPages; k++) {
			if ($("#assignToPage" + k).prop("checked")) {
				selPages.push("P"+k)
			}
		}

        selectedNode = graphComponent.selection.selectedNodes.toArray()[0]
		if (selPages.length != 0) {
			let constr = new IncidentEdgesOfVertexTo([[selectedNode], selPages])
			constraintsArray.push(constr);
			$("#constraintTags").tagit("createTag", constr.getPrintable())
		}
		$("#pageDialog").dialog("close")

	})
}





function fillAssignDialog() {
	var avPages = [1];
	var numberOfPages = parseInt(window.localStorage.getItem("numberOfPages"));
	let k;
	for(k=2; k<=numberOfPages; k++) {
		if ($("#page" + k).prop("checked")) {
			avPages.push(k);
		}
	}

	avPages.forEach( function(i) {
		$("#pageDialog").append(
				'<input type="checkbox" id="assignToPage'+i+'"> <label for="assignToPage'+i+'">Page '+i+'</label><br>'
		)
		$("#assignToPage"+i).checkboxradio();
	})


	$("#pageDialog").append('<button id="assignPages" class="ui-button ui-widget ui-corner-all">Assign</button>')



	$("#assignPages").click(function() {

		var selPages = [];
		let k;
		for (k=1; k<=numberOfPages; k++) {
			if ($("#assignToPage" + k).prop("checked")) {
				selPages.push("P"+k)
			}
		}

		var arr = []

		selEdges.forEach(function(a) {
			arr.push(a.toString())
		})
		console.log(selPages)
		if (selPages.length != 0) {
			let constr = new AssignedTo([selEdges, selPages])
			constraintsArray.push(constr);

			$("#constraintTags").tagit("createTag", constr.getPrintable())
		}
		$("#pageDialog").dialog("close")

	})
}

function testForContradictions(name) {
	//console.log(name)
}


$( function() {

	setTimeout(function() {
		var screenHeight = $(window).outerHeight()
		var pagesHeight = $("#pages").outerHeight()
		var footerHeight = $("#footer").outerHeight()
		var toolbarHeight = $(".toolbar").outerHeight()

		$("#graphComponent").height(screenHeight - (pagesHeight + footerHeight +toolbarHeight))
	},200)


	$( document ).tooltip();

	$("#page1").checkboxradio();
	$("#layoutP1").selectmenu({
		width: 120,
		position: { my : "top left", at: "top center" }

	});

	$("#typeP1").selectmenu({
		width: 120,
		position: { my : "top left", at: "top center" }
	});

	if ($(window).outerWidth() < 800) {
		$("#page1").checkboxradio({
			width: 70,
			label: " "
		})
		$("#typeP1").selectmenu("option", "width", "70")
		$("#layoutP1").selectmenu("option", "width", "70")
	}

	fillPages();
	disablePages();


	$( "#progressbar" ).progressbar({
		value: false
	});


	$("#exportDialog").dialog( {
		autoOpen: false,
		resizable: false,
		width: 230,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#greyDiv").hide();
		}
	});

	$("#deleteDialog").dialog( {
		autoOpen: false,
		resizable: false,
		width: 250,
		modal: true,open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#greyDiv").hide();
		}
	});

	$("#deletePageDialog").dialog( {
		autoOpen: false,
		resizable: false,
		width: 250,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#greyDiv").hide();
		}
	});

	$("#cancelledNotificationDialog").dialog({
		autoOpen: false,
		resizable: false,
		width: 400,
	})

	$("#imageDialog").dialog( {
		autoOpen: false,
		resizable: false,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#greyDiv").hide();
		}
	})

	$("#unselectPagesDialog").dialog({
		autoOpen: false,
		resizable: false,
		width: 250,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#greyDiv").hide();
		}
	})

	$("#pageDialog").dialog({
		width: 150,
		modal: true,
		resizable: false,
		autoOpen: false,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#pageDialog").empty();
			$("#greyDiv").hide();

		}
	})

	$("#ExportButton").click(function() {
		$( "#exportDialog" ).dialog( "open" );
	});

	$("#computeDialog").dialog({
		width: 250,
		resizable: false,
		autoOpen: false,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#greyDiv").hide();
		}
	})

	$("#computeDialog2").dialog({
		width: 250,
		resizable: false,
		autoOpen: false,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#greyDiv").hide();
		}
	})

	$("#wentWrong").dialog({
		width: 250,
		resizable: false,
		autoOpen: false,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#greyDiv").hide();
			$("#loadingDiv").hide();
		}
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

	$("#restrictEdgesDialog").dialog({
		modal: true,
		resizable: false,
		autoOpen: false,
		modal: true,
		modal: true,open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function( event, ui ) {
			$("#restrictEdgesDialog").empty();
			$("#greyDiv").hide();

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
		}
	})

	$("#serverDialog").dialog({
		autoOpen: false,
		width: 300,
		resizable: false,
		modal: true,
		open: function( event, ui ) {
			$("#greyDiv").show()
		},
		beforeClose: function(event, ui) {
			$("#serverUrl").val("");
			$("#greyDiv").hide()
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


	//$("#file").hide();
	$("#edit").hide();
	$("#view").hide();
	$("#layout").hide();
	$("#tools").hide();
	//$("#settings").hide();

	$("#greyDiv").hide();
	$("#loadingDiv").hide();

	$("#fileSettings").click(function(){
		$("#file").fadeToggle();
		$("#edit").hide();
		$("#view").hide();
		$("#layout").hide();
		$("#tools").hide();

	});

	$("#editSettings").click(function(){
		$("#edit").fadeToggle();
		$("#file").hide();
		$("#view").hide();
		$("#tools").hide();
		$("#layout").hide();

	});

	$("#viewSettings").click(function(){
		$("#view").fadeToggle();
		$("#file").hide();
		$("#edit").hide();
		$("#tools").hide();
		$("#layout").hide();

	});

	$("#layoutSettings").click(function(){
		$("#layout").fadeToggle();
		$("#file").hide();
		$("#edit").hide();
		$("#tools").hide();
		$("#view").hide();
	});

	$("#toolsSettings").click(function(){
		$("#tools").fadeToggle();
		$("#edit").hide();
		$("#file").hide();
		$("#view").hide();
		$("#layout").hide();

	});

	$("#graphSettings").click(function(){

		$("#settings").fadeToggle({
			duration: 'fast'
		});

		setTimeout(function() {
			if ($("#settings").is(":visible")) {
				var screenHeight = $(window).outerHeight()
				var pagesHeight = $("#pages").outerHeight()
				var footerHeight = $("#footer").outerHeight()
				var toolbarHeight = $(".toolbar").outerHeight()
				$("#graphComponent").height(screenHeight - (pagesHeight + footerHeight +toolbarHeight))
			}

			if ($("#settings").is(":hidden")) {
				var screenHeight = $(window).outerHeight()
				var pagesHeight = $("#pages").outerHeight()
				var footerHeight = $("#footer").outerHeight()
				var toolbarHeight = $(".toolbar").outerHeight()
				$("#graphComponent").height(screenHeight - (footerHeight +toolbarHeight))
			}
		}, 250)

	});



	$("#yesUnselect").click(function() {


		$("#typeP" + temp).selectmenu({
			disabled: true
		})
		$("#layoutP" + temp).selectmenu({
			disabled: true
		})
		deleteRelatedConstraints("p" + temp)
		disableFollowingPages(temp);

		$("#unselectPagesDialog").dialog("close")
	})

	$("#noDontUnselect").click(function() {

		$("#page" + temp).prop("checked", true);
		$("#page" + temp).button("refresh");
		$("#unselectPagesDialog").dialog("close")

	})


	/* Constraint Tags */



	$("#constraintTags").tagit({
		readOnly: true,
		readAndDelete: true,
		allowDuplicates: true,
		beforeTagRemoved: function(event, ui) {
			// do something special
			//alert(ui.tagLabel)

/*
			let i;
			for (i=0; i<constraintsArray.length; i++){
				if (constraintsArray[i].getPrintable() == ui.tagLabel) {
					// delete Constraints
					var temp1 = constraintsArray.slice(0,i)
					var temp2 = constraintsArray.slice(i+1, constraintsArray.length)
					constraintsArray = temp1.concat(temp2)
				}
			}
*/
            var i = ui.tag.index()
            var temp1 = constraintsArray.slice(0,i)
            var temp2 = constraintsArray.slice(i+1, constraintsArray.length)
            constraintsArray = temp1.concat(temp2)
		}
	});


	/*END */
} );