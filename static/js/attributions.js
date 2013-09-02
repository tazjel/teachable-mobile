var Attributions = function(){


	var rotate = function(array, positions){
		return array.concat(array.splice(0,positions+1));
	}

	var makeAttribution = function(attr){
		// Set facial expression
		$("body").removeClass().addClass(attr.emotion);
		// load sound
		AUDIO.setFile("attributionSound", "/mobileinterface/static/audio/" + attr.file);
		AUDIO.loadSound("attributionSound");
		// Attach handlers
		AUDIO.addStartListener("attributionSound", function(){
			// When robot starts to speak
			$("body").addClass("talking");
		});
		AUDIO.addFinishListener("attributionSound", function(){
			// When robot finishes speaking
			$("body").removeClass("talking");
			var time = Math.floor((Math.random()*5)+5)*1000;
			window.setTimeout(function(){
				$("body").removeClass().addClass("neutral");
			}, time);
		});
		// play sound
		window.setTimeout(function(){
			AUDIO.play("attributionSound");
		}, 6000);
	}

	return {
		makeAttribution : makeAttribution
	}
}

var attributions = Attributions();