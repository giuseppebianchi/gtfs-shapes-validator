$(document).ready(function(){
	
	const default_options = {
	map: {
		center: [41.89193, 12.51133],
		zoom: 14,
		minZoom: 1,
		maxZoom: 21,
		gestureHandling: true,
		zoomControl: false
	},
	icons: {
		fixed_pin: L.icon({
		    iconUrl: 'images/fixed_pin.svg',
		    iconSize:     [40, 40], // size of the icon
		    //shadowSize:   [50, 64], // size of the shadow
		    iconAnchor:   [20, 40], // point of the icon which will correspond to marker's location
		    //shadowAnchor: [4, 62],  // the same for the shadow
		    //popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
		}),
		error_pin: L.icon({
		    iconUrl: 'images/004-placeholder.svg',
		    iconSize: [40, 40],
		    iconAnchor:   [20, 40]
		 })
	},
	form: {
		init:{
			radius: 20,
			lat: 42.366,
			lon: 13.3944
		},
		decimal_re: /^[-+]?[0-9]+\.[0-9]+$/
	},
	gtfs:{
		shapes_fields: {
			"shape_id": 1,
			"shape_pt_lat": 2,
			"shape_pt_lon": 3,
			"shape_pt_sequence": 4,
			"shape_dist_traveled": 5
		}
	},
	modal:{
		details: " - Shape Details",
		errors: "Error Points of ",
		footer: '<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>',
		format: "JSON"
	},
	geojson: {
		url: "http://geojson.io"
	},
	fix:{
		step: parseFloat(0.00001), // good fas estimate
		big_step: parseFloat(0.0001), // good to edit
		markers: {}
	}
}

	const shapeSettingsForm = $("#shape-settings-form"),
			shapeFileInput = $("#shape-file-input"),
			shapeFileInputLabel = $("#shape-file-input-label")
			latitudeInput = $("#latitude-input"),
			longitudeInput = $("#longitude-input"),
			radiusInput = $("#radius-input"),
			rememberInput = $("#remember-input"),
			validationButton = $("#validation-button"),
			alert = $("#alert-box"),
			resultsSection = $("#results-section"),
			shapeResults = $("#shape-results"),
			shapeDetails = $("#shape-details"),
			shapeDetailsModalButton = $("#shape-details-modal-button"),
			shapeDetailsModal = $("#shape-details-modal"),
			shapeDetailsModalTitle = $("#shape-details-modal-title"),
			shapeDetailsModalBody = $("#shape-details-modal-body"),
			shapeDetailsModalFooter = $("#shape-details-modal-footer"),
			shapeErrorPoints = $("#shape-error-points"),
			selectedShape = $("#selected-shape"),
			copyCSV = $("#copy-open-geojsonio"),
			smartFixShape = $("#smartfix-shape"),
			editShape = $('#edit-shape'),
			cancelEditShape = $('#cancel-edit-shape'),
			shapeTextarea = $("#shape-textarea"),
			shapeDetailsModalFormats = $(".shape-formats-nav"),
			fixAllBadShapes = $("#fix-all-bad-shapes"),
			resetButton = $("#reset-button")

	let shapes = {}

	// initialize the map
	let map_options = localStorage.getItem("map-options") ? JSON.parse(localStorage.getItem("map-options")) : null
	if (!map_options) {
		map_options = { ...default_options.map }
	}

	//initialize form
	let form_data = localStorage.getItem("form-data") ? JSON.parse(localStorage.getItem("form-data")) : null
	if (form_data) {
		latitudeInput.val(form_data.latitudeInput)
		longitudeInput.val(form_data.longitudeInput)
		radiusInput.val(form_data.radiusInput)
		rememberInput.attr("checked", true)
	}else{
		if(default_options.form.init.radius){
			radiusInput.val(default_options.form.init.radius)
		}
		if(default_options.form.init.lat && default_options.form.init.lon){
			latitudeInput.val(default_options.form.init.lat)
			longitudeInput.val(default_options.form.init.lon)
		}
	}

	const map = L.map('map', map_options)

	const Light = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
	attribution: 'Map tiles by Carto/MapZen. Map data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
	minZoom: 1,
	maxZoom: 21
	}).addTo(map);

	L.control.zoom({
	    position: 'bottomright'
	}).addTo(map);

	//Shape File Input
	shapeFileInput.change(e => {
      const fileName = e.target.files[0].name;
      alert.html("")
      shapeFileInputLabel.addClass("loading-button");
      //debugger;
      //once file has been submitted
      let check_header = true;
      shapes = {}
		Papa.parse(e.target.files[0], {
			worker: true,
			header: true,
			skipEmptyLines: true,
			step: function(row, parser) {
				//console.log("Row:", row.data);
				//check if there are fields of shapes.txt
				if(row.errors.length){
					shapeFileInputLabel.addClass("btn-shape-validator-empty").removeClass("btn-shape-validator")
					const text = `<strong>Ops </strong>Invalid shapes. I found errors in your CSV. Check your file and upload it again.<br>
                 <strong>Invalid Rows</strong>: ${row.errors.length > 10 ? row.errors.slice(0, 9).map(e => e.row+1) + "... + " + parseInt(row.errors.length-10) + " more rows" : row.errors.map(e => e.row+1)}`
					printAlert(text, "danger", true)
					console.log(row.errors)
					parser.abort()
				}
				if(check_header){
					if(row.meta.fields.every(field => default_options.gtfs.shapes_fields.hasOwnProperty(field))){
						check_header = false
					}else{
						const text = `<strong>Ops </strong>Invalid shapes. It doesn't look as a <strong>shapes.txt</strong> file. Check <a  class="alert-link" href="https://developers.google.com/transit/gtfs/reference#shapestxt" target="_blank">GTFS Reference</a>`
						printAlert(text, "danger", true)
						shapeFileInputLabel.addClass("btn-shape-validator-empty").removeClass("btn-shape-validator")
						parser.abort()
					}
				}
				//debugger;
				row.data.shape_pt_lat = parseFloat(row.data.shape_pt_lat)
				row.data.shape_pt_lon = parseFloat(row.data.shape_pt_lon)
				row.data.shape_pt_sequence = parseInt(row.data.shape_pt_sequence)
				//if row is ok add it to shapes Map
			   if (!shapes.hasOwnProperty(row.data.shape_id)) {
			       shapes[row.data.shape_id] = {
			       	list: [row.data]
			       }
			   } else {
			       shapes[row.data.shape_id].list.push(row.data)
			   }
				
				
			},
			complete: function(results){
				shapeFileInputLabel.removeClass("loading-button");
				if(results){
					try{
						if(results.meta.aborted){
							//show alert
							return
						}
					}catch(err){
						//aborted is not available, which means that parse was ok
						//console.log(err)
					}
				}

				//if everything is ok
				shapeFileInputLabel.removeClass("btn-shape-validator-empty").addClass("btn-shape-validator").text(fileName)
				printAlert("<strong>Great! </strong> No parsing errors in your file.", "success", false)

				//check other fields to active validation button
				if(latitudeInput.val() != "" && longitudeInput.val() != "" && radiusInput.val() != ""){
					validationButton.removeAttr("disabled")
				}
			},
			error: function(err, file, inputElem, reason){
				console.log(err, file, inputElem, reason)
				shapeFileInputLabel.removeClass("loading-button");
			}
		})

  	});

	//Latitude Input
	latitudeInput.blur(e => {
		$(e.target).removeClass("error-input")
		if(isNaN(e.target.value)){
			$(e.target).addClass("error-input")
		}
	}).focus(e => {
		$(e.target).removeClass("error-input")
	})

	longitudeInput.blur(e => {
		$(e.target).removeClass("error-input")
		if(isNaN(e.target.value)){
			$(e.target).addClass("error-input")
		}
	}).focus(e => {
		$(e.target).removeClass("error-input")
	})

	radiusInput.blur(e => {
		if(isNaN(e.target.value)){
			$(e.target).addClass("error-input")
		}
	}).focus(e => {
		$(e.target).removeClass("error-input")
	})

	shapeSettingsForm.submit(e => {
		e.preventDefault()

		$(".error-input").removeClass("error-input")
		//check fields
		if(!shapeFileInput.prop("files")[0]){
			printAlert("<strong>Shape</strong> not found. Please upload <strong>shape.txt</strong> file", "danger", true)
			return false;
		}
		if(isNaN(latitudeInput.val())){
			printAlert("<strong>Latitude</strong> is not a coordinate", "danger", true)
			latitudeInput.addClass("error-input")
			return false;
		}
		if(isNaN(longitudeInput.val())){
			printAlert("<strong>Longitude</strong> is not a coordinate", "danger", true)
			longitudeInput.addClass("error-input")
			return false;
		}
		if(isNaN(longitudeInput.val())){
			printAlert("<strong>Radius</strong> is not a number", "danger", true)
			radiusInput.addClass("error-input")
			return false;
		}
		if(rememberInput.is(":checked")){
			localStorage.setItem("form-data", JSON.stringify({
				latitudeInput: latitudeInput.val(),
				longitudeInput: longitudeInput.val(),
				radiusInput: radiusInput.val(),
			}))
		}else{
			localStorage.removeItem("form-data")
		}

		//if everithing is ok
		const data = {
			lat: latitudeInput.val(),
			lon: longitudeInput.val(),
			radius: radiusInput.val()
		}
		default_options.circle = L.circle([data.lat, data.lon], {
			radius: data.radius*1000
		}).addTo(map)
		map.fitBounds(default_options.circle.getBounds());

		for(const prop in shapes){
			//check if distance between current coordinate and center is greater that radius
			//set valid field in shape obj, is true there is a point far away from center, which should represent an error in shape
			shapes[prop].list = shapes[prop].list.sort(function(a, b){return a.shape_pt_sequence - b.shape_pt_sequence})
			shapes[prop].errors = shapes[prop].list.filter((item, index) => {
				//save index
				return checkPosition(item.shape_pt_lat, item.shape_pt_lon, data)
			})

			shapeResults.append(`<a href="#" class="list-group-item list-group-item-action show-shape" data-id="${prop}"><strong>${prop}</strong> ${shapes[prop].errors.length ? '<span class="btn btn-danger float-right">Error</span>' : '<span class="btn btn-success float-right">Valid</span>'}</a>`)
		}
		resultsSection.show()
		location.hash = "#map";
		//console.log(shapes)
	})

	$("body").on("click", ".show-shape", e => {
		//clean error points box
		shapeErrorPoints.hide()
		smartFixShape.hide()
		cancelEditShape.hide()
		
		//remove markers from map
		for(const prop in default_options.fix.markers){
			default_options.fix.markers[prop].remove()
		}
		default_options.fix.markers = {}

		editShape.removeClass("editing").hide()
		//check if polyline already exits, if yes remove it from map
		if(default_options.polyline){
			default_options.polyline.remove()
		}
		//get shape id and its positions
		const id = $(e.currentTarget).data("id");
		const coordinates = shapes[id].list.map(item => {
			return [item.shape_pt_lat, item.shape_pt_lon]
		})
		//check if it has error points
		if(shapes[id].errors.length){
			//show error points
			const html = shapes[id].errors.map(item => {
				return `<li href="#" class="list-group-item list-group-item-action shape-error-points-item"}" data-lat="${item.shape_pt_lat}" data-lon="${item.shape_pt_lon}"><strong>${item.shape_pt_sequence}</strong>: [${item.shape_pt_lat}, ${item.shape_pt_lon}]</li>`
			})
			
			//check if was fixed
			if(shapes[id].fixed){
				shapeErrorPoints.html('<div class="alert alert-success" role="alert"><strong>Fixed Shape</strong>: <span class="alert-link">' + shapes[id].errors.length + '</span> uncorrect positions have been fixed.</div><div class="list-group" id="shape-error-points-list">' + html.join("") + '</div>')
				editShape.show()
			}else{
				smartFixShape.show()
				shapeErrorPoints.html('<div class="alert alert-danger" role="alert"><stron>Error Points</strong>: <span class="alert-link">' + shapes[id].errors.length + '</span> uncorrect positions found.</div><div class="list-group" id="shape-error-points-list">' + html.join("") + '</div>')
			}
			shapeErrorPoints.show()
			

			// zoom the map to the circle for highlighting points outside area
			default_options.polyline = L.polyline(coordinates, {color: 'red'}).addTo(map);
			map.fitBounds(default_options.circle.getBounds());
		}else{
			// zoom the map to the polyline
			default_options.polyline = L.polyline(coordinates, {color: 'red'}).addTo(map);
			map.fitBounds(default_options.polyline.getBounds());
		}
		selectedShape.data("id", id).text(id)
		shapeDetails.show()
	})

	shapeDetailsModalButton.click((e) => {
		e.preventDefault()
		const id = selectedShape.data("id");

		shapeDetailsModalFormats.find(".active").removeClass("active")
		shapeDetailsModalFormats.find("#json-format").addClass("active")
		
		let footer = null
		if(shapes[id].errors.length){
			//show fix button
			//footer = default_options.modal.footer + '<button class="btn btn-success" id="fix-">Fix Shape</button>'
		}
		//build modal
		buildModal({
			title: id + default_options.modal.details + (shapes[id].fixed ? ' - <span class="text-success">Fixed</span>' : ""),
			body: '<textarea id="shape-textarea">' + JSON.stringify(shapes[id].list, null, '	') + '</textarea>',
			footer: '',
		})
	})

	$("body").on("click", ".shape-error-points-item", e => {
		e.preventDefault()
		const lat = $(e.currentTarget).data("lat")
		const lon = $(e.currentTarget).data("lon")
		let marker = L.marker([lat, lon], {icon: default_options.icons.error_pin}).addTo(map);
		map.fitBounds(default_options.polyline.getBounds())
		setTimeout(() => marker.remove(), 10000)
	})

	smartFixShape.click(e => {
		//the idea is to set those coordinates outside radius distance near closest correct coordinate
		//then the file can be downloaded or copy-pasted on geojson.io to edit
		e.preventDefault()

		//validation function...
		const data = {
			lat: latitudeInput.val(),
			lon: longitudeInput.val(),
			radius: radiusInput.val()
		}
		const id = selectedShape.data("id");
		//check if has been already fixed
		if(shapes[id].fixed){
			return
		}
		$(e.currentTarget).addClass("loading-button")

		let coordinates = []
		
		let last_position = {
			lat: null,
			lon: null,
			step: 0 //default_options.fix.big_step
		};
		//filter because if first item is not valid it will not be returned
		shapes[id].list = shapes[id].list.filter(item => {
			if(checkPosition(item.shape_pt_lat, item.shape_pt_lon, data)){
				if(!last_position.lat){
					return false
				}
				item.shape_pt_lat = parseFloat(last_position.lat + last_position.step);
				item.shape_pt_lon = parseFloat(last_position.lon + last_position.step);
				last_position.lat = item.shape_pt_lat;
				last_position.lon = item.shape_pt_lon;
			}else{
				last_position.lat = item.shape_pt_lat;
				last_position.lon = item.shape_pt_lon;
			}
			coordinates.push([item.shape_pt_lat, item.shape_pt_lon])
			return item
		})
		shapes[id].fixed = true
		
		//show alert success
		shapeErrorPoints.find(".alert-danger").removeClass("alert-danger").addClass("alert-success").html(`<strong>Fixed Shape</strong>: <span class="alert-link">${shapes[id].errors.length}</span> uncorrect positions have been fixed.`)
		
		if(default_options.polyline){
			default_options.polyline.remove()
		}
		//print fixed polyline
		default_options.polyline = L.polyline(coordinates, {color: 'red'}).addTo(map);		
		$(e.currentTarget).removeClass("loading-button").hide()
		editShape.addClass("editing").show()
		//update results list
		shapeResults.find(`[data-id='${id}']`).append('<span class="btn btn-success float-right mr-2">Fixed</span>')

		//now add draggable markers to map
		//init markers map
		editingMarkers(id)

	})

	$(".shape-formats-nav-item").click(e => {
		e.preventDefault()
		e.stopPropagation()
		//JSON.stringify(shapes[id].list, null, ' ')
		updateModalDetails(selectedShape.data("id"), e.currentTarget.id, e)
	})
	
	const updateModalDetails = (id, format, event) => {
		let body;
		if(format == "json-format"){
			body = JSON.stringify(shapes[id].list, null, '	')
		}
		if(format == "csv-format"){
			body = getCSV(id)
		}
		if(format == "geojson-format"){
			body = getGeoJSON(id)
		}
		//update navbar
		shapeDetailsModalFormats.find(".active").removeClass("active")
		$(event.currentTarget).addClass("active")
		shapeDetailsModalBody.html('<textarea id="shape-textarea">' + body + '</textarea>')
	}
	const printAlert = (text, type, dismissible) => {
		alert.html(`<div id="alert-box" class="alert alert-${type} ${dismissible ? "alert-dismissible" : "" } fade show" role="alert">
      	${text} ${dismissible ? `<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>` : ""}</div>`)
	}

	const buildModal = (params) => {
		const { title, body, footer } = params;
		shapeDetailsModalTitle.html(title)
		shapeDetailsModalBody.html(body)
		if(footer){
			shapeDetailsModalFooter.html(footer)
		}else{
			shapeDetailsModalFooter.html(default_options.modal.footer)
		}
		shapeDetailsModal.modal("show");
	}

	const checkPosition = (latitude, longitude, center) => {
	   var ky = 40000 / 360;
	   var kx = Math.cos(Math.PI * center.lat / 180.0) * ky;
	   var dx = Math.abs(longitude - center.lon) * kx;
	   var dy = Math.abs(latitude - center.lat) * ky;
	   return Math.sqrt(dx * dx + dy * dy) > center.radius;
	}

	const handleMarkerDragend = (e) => {
		//debugger;
	}

	editShape.click(e => {
		e.preventDefault()
		const id = selectedShape.data("id")
		//check if has editing class
		if($(e.currentTarget).hasClass("editing")){
			//save changes
			//read each markers coordinates and save them into the same shape positions
			for(const prop in default_options.fix.markers){
				//get new markers coordinates
				const latlng = default_options.fix.markers[prop].getLatLng()
				//get shape_id and shape_pt_sequence from "alt" option or from prop
				//const fields = default_options.fix.markers[prop].options.alt.split("_")
				//[0] is shape_id - [1] is shape_pt_sequence
				const shape_pt_sequence = parseInt(prop)
				//try to access list via shape_pt_sequence
				if(shapes[id].list[shape_pt_sequence-1].shape_pt_sequence === shape_pt_sequence){
					//if yes save new coordinates
					shapes[id].list[shape_pt_sequence-1].shape_pt_lat = latlng.lat
					shapes[id].list[shape_pt_sequence-1].shape_pt_lon = latlng.lng
				}else{
					shapes[id].list.find(item => {
						if(item.shape_pt_sequence === shape_pt_sequence){
							item.shape_pt_lat = latlng.lat
							item.shape_pt_lon = latlng.lng
							return
						}
					})
				}
				default_options.fix.markers[prop].remove()
			}
			//print polyline with new positions
			if(default_options.polyline){
				default_options.polyline.remove()
			}
			const coordinates = shapes[id].list.map(item => [item.shape_pt_lat, item.shape_pt_lon])
			default_options.polyline = L.polyline(coordinates, {color: 'red'}).addTo(map);		
			$(e.currentTarget).removeClass("editing")
			cancelEditShape.hide()
		}else{
			//activate editing
			//print markers
			editingMarkers(id)
			$(e.currentTarget).addClass("editing")
			cancelEditShape.show()
		}

	})
	const editingMarkers = (id) => {
		default_options.fix.markers = {}
		shapes[id].errors.forEach(item => {
			default_options.fix.markers[item.shape_pt_sequence] = L.marker([item.shape_pt_lat, item.shape_pt_lon], {
				draggable: true,
				icon: default_options.icons.fixed_pin,
				riseOnHover: true,
				alt: item.shape_id + "_" + item.shape_pt_sequence
			})
			.on('dragend', handleMarkerDragend)
			.bindPopup("Shape Pt. Sequence: " + item.shape_pt_sequence)
			.addTo(map);
		})
		//zoom to first marker
		map.flyTo(default_options.fix.markers[Object.keys(default_options.fix.markers)[0]].getLatLng(), 16)
	}

	cancelEditShape.click(e => {
		e.preventDefault()
		//remove markers from map
		for(const prop in default_options.fix.markers){
			default_options.fix.markers[prop].remove()
		}
		//fitbound on polyline
		map.fitBounds(default_options.polyline.getBounds());
		$(e.currentTarget).hide()
		default_options.fix.markers = {}
		editShape.removeClass("editing")
	})

	fixAllBadShapes.click(e => {
		$(e.currentTarget).addClass("fixing")
		const data = {
			lat: latitudeInput.val(),
			lon: longitudeInput.val(),
			radius: radiusInput.val()
		}
		//check all entries of shapes map
		for(const id in shapes){
			//debugger;
			let last_position = {
				lat: null,
				lon: null,
				step: 0 //default_options.fix.big_step
			};
			//check if it's already fixed
			if(!shapes[id].fixed && shapes[id].errors.length){
				//filter because if first item is not valid it will not be returned
				shapes[id].list = shapes[id].list.filter(item => {
					if(checkPosition(item.shape_pt_lat, item.shape_pt_lon, data)){
						if(!last_position.lat){
							return false
						}
						item.shape_pt_lat = parseFloat(last_position.lat + last_position.step);
						item.shape_pt_lon = parseFloat(last_position.lon + last_position.step);
						last_position.lat = item.shape_pt_lat;
						last_position.lon = item.shape_pt_lon;
					}else{
						last_position.lat = item.shape_pt_lat;
						last_position.lon = item.shape_pt_lon;
					}
					return item
				})
				shapes[id].fixed = true
				shapeResults.find(`[data-id='${id}']`).append('<span class="btn btn-success float-right mr-2">Fixed</span>')	
			}
		}

		$(e.currentTarget).removeClass("fixing").addClass("fixed")
	})

	$('.export-button').click(e => {
		// Start file download.
		$(e.currentTarget).addClass("exporting")
		const format = $(e.currentTarget).data("format")
		let name, text; 
		switch(format){
			case "json": name = "shapes.json"; text = JSON.stringify(shapes, null, '	'); break;
			case "geojson": name = "shapes.geojson"; text = getGeoJSON(); break;
			case "csv": name = "shapes.txt"; text = getCSV(); break;
			default: name = "shapes.txt"
		}
		$(e.currentTarget).removeClass("exporting")
		download(name,text);
	})
	const getCSV = (id) => {
		//check unparse of papaparse
		const keys = Object.keys(default_options.gtfs.shapes_fields);
		let csv = keys.join(",") + "\n"
		if(id){
			//just for a shape
			shapes[id].list.map(item => {
				keys.every
				for(let i in keys){
					csv += item[keys[i]]
					csv += i < keys.length-1 ? "," : "\n"
				}	
			})
		}else{
			//all shapes
			for(const prop in shapes){
				shapes[prop].list.map(item => {
					keys.every
					for(let i in keys){
						csv += item[keys[i]]
						csv += i < keys.length-1 ? "," : "\n"
					}	
				})
			}	
		}
		return csv;
	}
	const getGeoJSON = (id) => {
		if(id){
			JSON.stringify({
			    "type": "Feature",
			    "properties": {
			        "shape_id": id,
			    },
			    "geometry": {
			        "type": "LineString",
			        "coordinates": shapes[id].list.map(p => [p.shape_pt_lon, p.shape_pt_lat])
			    }
			}, null, '	')
		}else{
			//all shapes
			for(const prop in shapes){
				//
				// ? // check geojson docs
			}
		}
	}

	const download = (filename, text) => {
	  var element = document.createElement('a');
	  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	  element.setAttribute('download', filename);
	  element.style.display = 'none';
	  document.body.appendChild(element);
	  element.click();
	  document.body.removeChild(element);
	}

	resetButton.click(e => {
		//temp reset
		location.reload();


		//hide results sections

		//reset shapes map

		//reset options, such as circle and polyline

		//reset inputs
	})

	

})