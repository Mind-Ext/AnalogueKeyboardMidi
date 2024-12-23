let analogDevice = null
let midiPort = null

////// hid device (keyboard) ///////

async function doConnect() {
  if (analogDevice) {
    analogDevice.forget()
    analogDevice = undefined
  }
  const device = await analogsense.requestDevice()
  if (device) {
    initDemo(device)
  }
}

function initDemo(device) {
  analogDevice = device
  const name = device.getProductName()
  vstore.keyboardName = name
  vstore.connected = true
  console.log('Connected to device:', name)

  calibration.reset()
  device.startListening(keyHandler)
}

function doDisconnect() {
  const name = analogDevice.getProductName()
  vstore.keyboardName = 'None'
  vstore.reportInterval = '?'
  vstore.connected = false
  analogDevice.forget()
  analogDevice = undefined
  console.log('Disconnected from device:', name)
}

async function checkPairedDevices() {
  const devices = await analogsense.getDevices()
  if (devices.length != 0) {
    initDemo(devices[0])
  }
}

if ('hid' in navigator) {
  checkPairedDevices()

  navigator.hid.onconnect = function (event) {
    if (!analogDevice) {
      checkPairedDevices()
    }
  }

  navigator.hid.ondisconnect = function (event) {
    if (analogDevice && event.device == analogDevice.dev) {
      analogDevice = undefined
    }
  }
} else {
  alert(`Your browser does not support WebHID. You need to be on a desktop and
            using Chrome, Edge, Safari, or an alternative Chromium-based browser.`)
}

////// MIDI //////

function openMidiPort(name) {
  if (!WebMidi.enabled) {
    alert('WebMIDI is not enabled')
    return
  }
  midiPort = WebMidi.getOutputByName(name)
  if (!midiPort) {
    console.log('MIDI output port not found:', name)
    return
  }
  console.log('Selected MIDI output port:', midiPort.name)
}

WebMidi.enable((err) => {
  if (err) {
    alert('WebMIDI could not be enabled: ', err)
    return
  }

  // Get the select element
  const midiOutputSelect = document.getElementById('midiOutputSelect')

  let nPorts = 0
  // Populate the select element with MIDI output ports
  WebMidi.outputs.forEach((output) => {
    const option = document.createElement('option')
    option.value = output.name
    option.textContent = output.name
    midiOutputSelect.appendChild(option)
    nPorts += 1
  })
  console.log('MIDI output ports =', nPorts)

  loadOptions()
  // Listen for changes to the select element
  midiOutputSelect.addEventListener('change', () => {
    const selectedOutputName = midiOutputSelect.value
    openMidiPort(selectedOutputName)
    saveOptions()
  })
})

////// UI //////

const vstore = PetiteVue.reactive({
  connected: false,
  keyboardName: 'None',
  transpose: 0,
  dRow: 1,
  dCol: 4,
  reportInterval: '?',
  showLastNote: true,
  lastNote: 'None',
  updateLayout(ddR, ddC, dTranspose) {
    this.dRow += ddR
    this.dCol += ddC
    this.transpose += dTranspose
    updateKeyLabels()
    saveOptions()
  },
})

PetiteVue.createApp({
  vstore,
}).mount()

const keyboardKeys = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
]

const keyToMidi = {}

function updateKeyLabels() {
  const note1 = 43 // midi note for key 1
  const elements = document.getElementsByClassName('key-label-midi')
  let i = 0
  for (let r = 0; r < keyboardKeys.length; r++) {
    for (let c = 0; c < keyboardKeys[r].length; c++) {
      const note = vstore.dRow * r + vstore.dCol * c + note1 + vstore.transpose
      elements[i].textContent = note
      keyToMidi[keyboardKeys[r][c]] = note
      i += 1
    }
  }
  updateHightlight()
}

function updateHightlight() {
  const selection = document.getElementById('highlightPitchClass')
  const elements = document.getElementsByClassName('key-label-midi')
  for (let i = 0; i < elements.length; i++) {
    if (selection.value == elements[i].textContent % 12) {
      elements[i].parentElement.classList.add('highlight')
    } else {
      elements[i].parentElement.classList.remove('highlight')
    }
  }
}

function saveOptions() {
  const options = {
    dRow: vstore.dRow,
    dCol: vstore.dCol,
    transpose: vstore.transpose,
    showLastNote: vstore.showLastNote,
    highlightPitchClass: document.getElementById('highlightPitchClass').value,
    midiOutputSelect: document.getElementById('midiOutputSelect').value,
  }
  localStorage.setItem('options', JSON.stringify(options))
}

function loadOptions() {
  const options = JSON.parse(localStorage.getItem('options'))
  if (options) {
    vstore.dRow = options.dRow
    vstore.dCol = options.dCol
    vstore.transpose = options.transpose
    vstore.showLastNote = options.showLastNote
    document.getElementById('highlightPitchClass').value =
      options.highlightPitchClass
    document.getElementById('midiOutputSelect').value = options.midiOutputSelect
    openMidiPort(options.midiOutputSelect)
    updateKeyLabels()
  }
}

// make key element for each row in id keys
function initKeyUI() {
  let i = 1
  for (const row of keyboardKeys) {
    const rowEl = document.createElement('div')
    rowEl.className = 'key-row'
    rowEl.id = 'row' + i
    rowEl.style.paddingLeft = `calc(var(--key-size)*0.5*${i - 1})`
    for (const key of row) {
      const keyEl = document.createElement('div')
      keyEl.className = 'key'
      keyEl.id = 'key-' + key
      rowEl.appendChild(keyEl)

      const keyFillEl = document.createElement('div')
      keyFillEl.className = 'key-fill'
      keyFillEl.id = 'key-fill-' + key
      keyEl.appendChild(keyFillEl)

      const keyLabelEl = document.createElement('div')
      keyLabelEl.className = 'key-label-letter'
      keyLabelEl.textContent = key
      keyEl.appendChild(keyLabelEl)

      const keyLabelMidiEl = document.createElement('div')
      keyLabelMidiEl.className = 'key-label-midi'
      keyLabelMidiEl.id = 'key-label-midi-' + key
      keyEl.appendChild(keyLabelMidiEl)
    }
    document.getElementById('keys').appendChild(rowEl)
    i += 1
  }
  updateKeyLabels()
}

initKeyUI()

document
  .getElementById('highlightPitchClass')
  .addEventListener('change', (event) => {
    updateHightlight()
    saveOptions()
  })

////// Analog to MIDI //////

class KeyState {
  constructor(name) {
    this.name = name
    this.isOn = false
    this.threshold = 0.05
    // filter out keys report non-zero at rest
    this.TRAVEL = 4
    this.maxVelocity = 1 / 6
    this.minVelocity = 0.5 * this.threshold * this.maxVelocity
    this.queue = []
  }

  update(value) {
    if (this.isOn && value < this.threshold) {
      this.stop()
      this.isOn = false
      this.queue = []
      return
    }
    if (!this.isOn && value > 0) {
      this.queue.push(value)
      if (this.queue.length == 2) {
        // need two nonzero values to estimate velocity (linear slope)
        // [0, value1, value2]
        // 0 is assumed (no explicit zero reading)
        // onset is somewhere between 0 and value1
        const diff12 = this.queue[1] - this.queue[0]
        const diff01 = this.queue[0]
        const diff = Math.max(diff12, diff01)
        // max diff is 1, e.g. immediately get a reading of 1
        // actual velocity is (at least) 4mm travel in 6ms = 0.67m/s
        // normalize by travel and report interval for different keyboards
        const velocity = diff / calibration.reportInterval
        // normalize by to 0~1
        this.queue = []
        if (velocity > this.minVelocity) {
          const attack =
            (velocity - this.minVelocity) /
            (this.maxVelocity - this.minVelocity)
          const velocityInt = 1 + Math.floor(attack * 127)
          const msg = `Note ${keyToMidi[this.name]}, velocity ${velocityInt}`
          this.play(velocityInt)
          this.isOn = true
          vstore.lastNote = msg
          // attack.toFixed(2),
          // diff.toFixed(2)
          return msg
        }
      }
      // TODO: aftertouch
    }
  }

  play(velocity) {
    // attack is 0~1 (corresponding to velocity 0~127)
    if (!midiPort) {
      return
    }
    midiPort.playNote(keyToMidi[this.name], { rawAttack: velocity })
    // document.getElementById('key-' + this.name).classList.add('active')
  }

  stop() {
    if (!midiPort) {
      return
    }
    midiPort.stopNote(keyToMidi[this.name])
    // document.getElementById('key-' + this.name).classList.remove('active')
  }
}

class AnalogToMidi {
  constructor() {
    this.state = {}
    for (const key of keyboardKeys.flat()) {
      this.state[key] = new KeyState(key)
    }
  }

  update(currentActive, prevActive) {
    const status = []
    for (const [key, value] of currentActive) {
      const msg = this.state[key].update(value)
      if (msg) {
        status.push(msg)
      }
    }
    for (const key of prevActive.keys()) {
      this.state[key].update(0)
    }
    if (status.length > 0 && vstore.showLastNote) {
      vstore.lastNote = status.join('; ')
    }
  }
}

const analogToMidi = new AnalogToMidi()

let prevTime = performance.now()
let prevActive = new Map()
const calibration = {
  n: -10, // drop first 10 samples (initial delay?)
  nSamples: 150,
  tStart: 0,
  tEnd: 0,
  reportInterval: 6,
  done: false,
  reset() {
    this.n = -10
    this.done = false
  },
  update() {
    if (this.n > this.nSamples) {
      return
    }
    if (this.n == 0) {
      this.tStart = performance.now()
    }
    if (this.n == this.nSamples) {
      this.tEnd = performance.now()
      this.reportInterval = (this.tEnd - this.tStart) / this.nSamples
      vstore.reportInterval = this.reportInterval.toFixed(1)
      this.done = true
      document.getElementById('keys').classList.remove('white-text')
    }
    this.n += 1
  },
}

function calibrate() {
  document.getElementById('keys').classList.add('white-text')
  vstore.reportInterval = '?'
  calibration.reset()
}

function keyHandler(active_keys) {
  if (!calibration.done) {
    calibration.update()
    return
  }
  let currentActive = new Map()
  for (const key of active_keys) {
    const keyLetter = analogsense.scancodeToString(key.scancode)
    const keyFillEl = document.getElementById('key-fill-' + keyLetter)
    if (!keyFillEl) {
      continue
    }
    keyFillEl.style.height = key.value * 100 + '%'
    currentActive.set(keyLetter, key.value)
    prevActive.delete(keyLetter)
  }
  for (const keyLetter of prevActive.keys()) {
    const keyFillEl = document.getElementById('key-fill-' + keyLetter)
    if (!keyFillEl) {
      continue
    }
    keyFillEl.style.height = 0
  }
  analogToMidi.update(currentActive, prevActive)
  prevActive = currentActive
}

//////
