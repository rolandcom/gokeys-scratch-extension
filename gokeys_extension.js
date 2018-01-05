/*
 *This program is free software: you can redistribute it and/or modify
 *it under the terms of the GNU General Public License as published by
 *the Free Software Foundation, either version 3 of the License, or
 *(at your option) any later version.
 *
 *This program is distributed in the hope that it will be useful,
 *but WITHOUT ANY WARRANTY; without even the implied warranty of
 *MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *GNU General Public License for more details.
 *
 *You should have received a copy of the GNU General Public License
 *along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function(ext) {

	var deviceConnect = false;
	var inport = -1;
	var inputs = [];
	var outport = -1;
	var outputs = [];

	var f8Cnt = 0;
	var beatCnt = 0;
	var measCnt = 0;

	var startStop = false;

	var rsv_note = 0;
	var rsv_velo = 0;
	var noteon_flg = false;

	const TPQN = 24;
	const BEAT = 4;
	const OCTAVE_KEYS = 12;

/* -------------------------------------------------------------------------	*/
	midiInit();

	function midiInit() 
	{
		inputs = [];
		outputs = [];
		navigator.requestMIDIAccess({sysex:false}).then( success, failure );
	}

	function handleStateChange(event) 
	{
		if (event.port.state == "connected") {
			console.log("GO:KEYS Connected");
		} else {
			deviceConnect = false;
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
				console.log('Outport = %d', outport);
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
					startStop = true;
				} else if (ev.data[0] == 0xFC) {
					startStop = false;
					f8Cnt = 0;
					beatCnt = 0;
					measCnt = 0;
				} else if (ev.data[0] == 0xF8) {
					deviceConnect = true;
					if (startStop) {
						f8Cnt++;
						measCnt = Math.floor(f8Cnt / (TPQN * BEAT));
						beatCnt = Math.floor(f8Cnt / TPQN);
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
		return (f8Cnt);
	};

	ext.func_meas = function() {
		return (measCnt + 1);
	};

	ext.func_beat = function() {
		return ((beatCnt % BEAT) + 1) ;
	};

	ext.func_note = function() {
		return ((rsv_note % OCTAVE_KEYS) + 1);
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

	ext.func_fix_key_on = function(note) {

		var key = rsv_note % OCTAVE_KEYS;

		if (descriptor.menus.key[key] == note) {
			if (noteon_flg) {
				noteon_flg = false;
				return true;
			}
		}
	};

	ext.func_stop = function(part) {
		switch (part) {
		case 'All':
			startStop = false;
			measCnt = 0;
			f8Cnt = 0;
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

		for (var i = 0; i < descriptor.menus.type.length; i++) {
			if (descriptor.menus.type[i] === type) {
				sendNRPN(0x0F, 0, 0, 0, i);
			}
		}

		setTimeout(function() { callback(); }, 500);
	};

	ext.func_chord = function(chord) {

		for (var i = 0; i < descriptor.menus.key.length; i++) {
			if (descriptor.menus.key[i] === chord) {
				sendNRPN(0x0F, 0, 2, 0, i);
			}
		}

	};

	ext.func_wait_meas = function(wait, callback) {

		var dstTime = f8Cnt + (wait * BEAT * TPQN);

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
			[' ', 'key %m.key', 'func_chord', 'C'],
			['w', 'wait %n measure', 'func_wait_meas', 1],
			['r', 'measure', 'func_meas'],
			['r', 'beat', 'func_beat'],
			['r', 'tick', 'func_f8'],
			['h', 'key on',	'func_key_on'],
			['h', 'key on %m.key', 'func_fix_key_on', 'C'],
			['r', 'note', 'func_note'],
			['r', 'velocity', 'func_velo'],
			['-'],
		],
		menus: {
			key: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',],
			type: ['Trance','Funk','House','Drum N Bass','Neo HipHop','Pop','Bright Rock','Trap Step','Future Bass','Trad HipHop','EDM','R&B', 'Reggaeton', 'Cumbia', 'ColombianPop', 'Bossa Lounge', 'Arrocha', 'Drum N Bossa', 'Bahia Mix', 'Power Rock', 'Classic Rock', 'J-Pop'],
			play: ['Drums', 'Bass', 'Melody A', 'Melody B'],
			stop: ['All', 'Drums', 'Bass', 'Melody A', 'Melody B'],
		},
		url: 'https://rolandcom.github.io/gokeys-scratch-extension'
	};

	// Register the extension
	ScratchExtensions.register('GO:KEYS Extesion', descriptor, ext);

})({});
