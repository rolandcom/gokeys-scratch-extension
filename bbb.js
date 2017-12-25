
(function(ext) {

	var inputs = [];
	var outputs = [];

	var f8Cnt = 0;
	var startStop = 0;
	var measCnt = 0;
	var beatCnt = 0;
	var deviceConnect = 0;
	var inport = -1;
	var outport = -1;
	var rsv_note = 0;
	var rsv_velo = 0;

/* -------------------------------------------------------------------------	*/
	midiInit();

	function midiInit() 
	{
		inputs = [];
		outputs = [];
		navigator.requestMIDIAccess({sysex:false}).then( success, failure );
		console.log("MIDI Init");
	}

	function handleStateChange(event) 
	{
		if (event.port.state == "connected") {
			console.log("GO:KEYS Connected");
		} else {
			deviceConnect = 0;
			console.log("GO:KEYS Disconnected");
		}
	}

	function success( midi ) 
	{
		var inputIterator = midi.inputs.values();
		for (var o = inputIterator.next(); !o.done; o = inputIterator.next()) {
			inputs.push(o.value)
		}

		var outputIterator = midi.outputs.values();
		for (var o = outputIterator.next(); !o.done; o = outputIterator.next()) {
			outputs.push(o.value)
		}
		outport = -1;
		for (var i = 0; i < outputs.length; i++){
			var string = outputs[i].name;
			if (string.indexOf('GO:KEYS') > -1) {
				outport = i;
				console.log(outport);
			}
		}
		inport = -1;
		for (var i = 0; i < inputs.length; i++){
			var string = outputs[i].name;
			if (string.indexOf('GO:KEYS') > -1) {
				inport = i;
				inputs[i].onmidimessage = handleMIDIMessage;
				inputs[i].onstatechange = handleStateChange;
			}
		}
		if (outport < 0 || inport < 0) setTimeout(function() { midiInit(); }, 2000);
	}

	function failure(error) 
	{
		setTimeout(function() { midiInit(); }, 2000);
		console.log("MIDI NG");
	}

	function handleMIDIMessage( ev ) {

		var ch = ev.data[0] & 0x0F;

		switch (ev.data[0] & 0xF0) {
			case 0x80:
				break;
			case 0x90:
				if (ch <= 6) {
					rsv_note = ev.data[1];
					rsv_velo = ev.data[2];
					noteon_flg = true;
				}
				break;
			case 0xA0:
				break;
			case 0xB0:
				break;
			case 0xC0:
				break;
			case 0xD0:
				break;
			case 0xE0:
				break;
			case 0xF0:
				if (ev.data[0] == 0xFA) {
					startStop = 1;
					console.log("0xFA");
				} else if (ev.data[0] == 0xFC) {
					startStop = 0;
					f8Cnt = 0;
					beatCnt = 0;
					measCnt = 0;
					console.log("0xFC");
				} else if (ev.data[0] == 0xF8) {
					deviceConnect = 1;
					if (startStop) {
						f8Cnt++;
						measCnt = Math.floor(f8Cnt / 96);
						beatCnt = Math.floor(f8Cnt / 24);
					}
				}
				break;
		}

	}

	function sendNRPN(ch, nrpn_msb, nrpn_lsb, data_msb, data_lsb)
	{
		sendMIDI(0xB0 | ch, 0x63, nrpn_msb);
		sendMIDI(0xB0 | ch, 0x62, nrpn_lsb);
		sendMIDI(0xB0 | ch, 0x06, data_msb);
		sendMIDI(0xB0 | ch, 0x26, data_lsb);
	}

	function sendMIDI(d0, d1, d2)
	{
		outputs[outport].send([d0, d1, d2], window.performance.now());
	}


/* -------------------------------------------------------------------------	*/
	ext.func_f8 = function() {
		return (f8Cnt % 96);
	};

	ext.func_meas = function() {
		return (measCnt+1);
	};

	ext.func_beat = function() {
		return ((beatCnt % 4) + 1) ;
	};

	ext.func_note = function() {
		return (rsv_note % 12);
	};

	ext.func_velo = function() {
		return Math.floor(rsv_velo / 127 * 100);
	};

	ext.func_key_on = function() {
		if (noteon_flg) {
			noteon_flg = false;
			return true;
		}
		return false;
	};

	ext.func_stop = function(part) {
		switch (part) {
		case 'All':
			startStop = 0;
			measCnt = 0;
			f8Cnt = 0;
			console.log("stop All");
			sendNRPN(0x0F, 0, 3, 0, 0);
			break;
		case 'Drums':
			sendNRPN(0x0F, 0, 3, 0, 1);
			break;
		case 'Bass':
			sendNRPN(0x0F, 0, 3, 0, 2);
			break;
		case 'Melody A':
			sendNRPN(0x0F, 0, 3, 0, 3);
			break;
		case 'Melody B':
			sendNRPN(0x0F, 0, 3, 0, 4);
			break;
		}
	};

	ext.func_drum = function(val) {
		val = Math.floor(val);
		val--;
		if (val < 0) val = 0;
		if (val > 10) val = 10;
		sendNRPN(0x0F, 0, 1, 0, val);
	};

	ext.func_bass = function(val) {
		val = Math.floor(val);
		val--;
		if (val < 0) val = 0;
		if (val > 10) val = 10;
		sendNRPN(0x0F, 0, 1, 1, val);
	};

	ext.func_parta = function(val) {
		val = Math.floor(val);
		val--;
		if (val < 0) val = 0;
		if (val > 10) val = 10;
		sendNRPN(0x0F, 0, 1, 2, val);
	};

	ext.func_partb = function(val) {
		val = Math.floor(val);
		val--;
		if (val < 0) val = 0;
		if (val > 10) val = 10;
		sendNRPN(0x0F, 0, 1, 3, val);
	};

	ext.func_play = function(part, val) {
		val--;
		if (val < 0) val = 0;
		if (val > 10) val = 10;
		switch (part) {
		case 'Drums':
			sendNRPN(0x0F, 0, 1, 0, val);
			break;
		case 'Bass':
			sendNRPN(0x0F, 0, 1, 1, val);
			break;
		case 'Melody A':
			sendNRPN(0x0F, 0, 1, 2, val);
			break;
		case 'Melody B':
			sendNRPN(0x0F, 0, 1, 3, val);
			break;
		}
	};


	ext.func_type = function(type, callback) {

		switch (type) {
		case 'Trance':
			sendNRPN(0x0F, 0, 0, 0, 0);
			break;
		case 'Funk':
			sendNRPN(0x0F, 0, 0, 0, 1);
			break;
		case 'House':
			sendNRPN(0x0F, 0, 0, 0, 2);
			break;
		case 'Drum N Bass':
			sendNRPN(0x0F, 0, 0, 0, 3);
			break;
		case 'Neo HipHop':
			sendNRPN(0x0F, 0, 0, 0, 4);
			break;
		case 'Pop':
			sendNRPN(0x0F, 0, 0, 0, 5);
			break;
		case 'Bright Rock':
			sendNRPN(0x0F, 0, 0, 0, 6);
			break;
		case 'Trap Step':
			sendNRPN(0x0F, 0, 0, 0, 7);
			break;
		case 'Future Bass':
			sendNRPN(0x0F, 0, 0, 0, 8);
			break;
		case 'Trad HipHop':
			sendNRPN(0x0F, 0, 0, 0, 9);
			break;
		case 'EDM':
			sendNRPN(0x0F, 0, 0, 0, 10);
			break;
		case 'R&B':
			sendNRPN(0x0F, 0, 0, 0, 11);
			break;
		case 'Reggaeton':
			sendNRPN(0x0F, 0, 0, 0, 12);
			break;
		case 'Cumbia':
			sendNRPN(0x0F, 0, 0, 0, 13);
			break;
		case 'ColombianPop':
			sendNRPN(0x0F, 0, 0, 0, 14);
			break;
		case 'Bossa Lounge':
			sendNRPN(0x0F, 0, 0, 0, 15);
			break;
		case 'Arrocha':
			sendNRPN(0x0F, 0, 0, 0, 16);
			break;
		case 'Drumfn Bossa':
			sendNRPN(0x0F, 0, 0, 0, 17);
			break;
		case 'Bahia Mix':
			sendNRPN(0x0F, 0, 0, 0, 18);
			break;
		case 'Power Rock':
			sendNRPN(0x0F, 0, 0, 0, 19);
			break;
		case 'Classic Rock':
			sendNRPN(0x0F, 0, 0, 0, 20);
			break;
		case 'J-Pop':
			sendNRPN(0x0F, 0, 0, 0, 21);
			break;
		}
		setTimeout(function() { callback(); }, 500);
	};

	ext.func_chord = function(chord) {

		switch (chord) {
		case 'C':
			sendNRPN(0x0F, 0, 2, 0, 0);
			break;
		case 'C#':
			sendNRPN(0x0F, 0, 2, 0, 1);
			break;
		case 'D':
			sendNRPN(0x0F, 0, 2, 0, 2);
			break;
		case 'D#':
			sendNRPN(0x0F, 0, 2, 0, 3);
			break;
		case 'E':
			sendNRPN(0x0F, 0, 2, 0, 4);
			break;
		case 'F':
			sendNRPN(0x0F, 0, 2, 0, 5);
			break;
		case 'F#':
			sendNRPN(0x0F, 0, 2, 0, 6);
			break;
		case 'G':
			sendNRPN(0x0F, 0, 2, 0, 7);
			break;
		case 'G#':
			sendNRPN(0x0F, 0, 2, 0, 8);
			break;
		case 'A':
			sendNRPN(0x0F, 0, 2, 0, 9);
			break;
		case 'A#':
			sendNRPN(0x0F, 0, 2, 0, 10);
			break;
		case 'B':
			sendNRPN(0x0F, 0, 2, 0, 11);
			break;
		}
	};

	ext.func_wait_meas = function(wait, callback) {

		var dstTime = f8Cnt + (wait*96);

		var timerID = setInterval(function() {
			if (f8Cnt >= dstTime) {
				clearInterval(timerID);
				callback();
			}
		}, 1);
	};

/* -------------------------------------------------------------------------	*/
/* for Scratch Extension  */
/* -------------------------------------------------------------------------	*/
	ext._shutdown = function() {};

	ext._getStatus = function() {
		if (!deviceConnect) return {status: 1, msg: 'GO:KEYS not connected'};
		return {status: 2, msg: 'GO:KEYS connected'};
	};
/* -------------------------------------------------------------------------	*/
	var descriptor = {
		blocks: [
			['w', 'loop mix %m.type', 'func_type', 'Trance'],
			[' ', 'play %m.play  %n', 'func_play', 'Drums', 1],
			[' ', 'stop %m.stop', 'func_stop', 'All'],
			[' ', 'key %m.chord', 'func_chord', 'C'],
			['w', 'wait %n measure', 'func_wait_meas', 1],
			['r', 'measure', 'func_meas'],
			['r', 'beat', 'func_beat'],
			['r', 'tick', 'func_f8'],
			['h', 'key on',	'func_key_on'],
			['r', 'note', 'func_note'],
			['r', 'velocity', 'func_velo'],
			['-'],
		],
		menus: {
			chord: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',],
			type: ['Trance','Funk','House','Drum N Bass','Neo HipHop','Pop','Bright Rock','Trap Step','Future Bass','Trad HipHop','EDM','R&B', 'Reggaeton', 'Cumbia', 'ColombianPop', 'Bossa Lounge', 'Arrocha', 'Drum N Bossa', 'Bahia Mix', 'Power Rock', 'Classic Rock', 'J-Pop'],
			play: ['Drums', 'Bass', 'Melody A', 'Melody B'],
			stop: ['All', 'Drums', 'Bass', 'Melody A', 'Melody B'],
		},
		url: 'https://rolandcom.github.io/gokeys-scratch-extension'
	};

	// Register the extension
	ScratchExtensions.register('GO:KEYS Extesion', descriptor, ext);

})({});
