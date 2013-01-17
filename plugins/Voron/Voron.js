define(['kievII',
        'https://github.com/corbanbrook/dsp.js/raw/master/dsp.js',
        'https://github.com/janesconference/KievII/raw/master/dsp/pitchshift.js',
        'image!'+ require.toUrl('assets/images/Voron_bg2.png'),
        'image!'+ require.toUrl('assets/images/white_big.png')],
        function(k2, dsp, pitchshift, bgImage, kImage) {

  var backgroundImage =  bgImage;
  var knobImage =  kImage;
  var nSamples = 2048;
  var fftFrameSize = 2048;
  shifterStartValue = 0;
  
  var pluginConf = {
      osc: true,
      audioIn: true,
      audioOut: true,
      canvas: {
          width: 766,
          height: 527
      },
  }
  var initPlugin = function(args) {
    console.log ("plugin inited, args is", args, "KievII object is ", K2, "bg image is", backgroundImage);
    
    this.name = args.name;
    this.id = args.id;
    
    // The sound part
    this.audioSource = args.audioSource;
    this.audioDestination = args.audioDestination;
    this.context = args.audioContext;
    var context = this.context;
    
    this.processorNode = this.context.createJavaScriptNode(nSamples);
    
    this.shifter = new Pitchshift(fftFrameSize, this.context.sampleRate, 'FFT');
    
    this.processorNode.onaudioprocess = function (event) {
        // Get left/right input and output arrays
        var outputArray = [];
        outputArray[0] = event.outputBuffer.getChannelData(0);
        //outputArray[1] = event.outputBuffer.getChannelData(1);
        var inputArray = [];
        inputArray[0] = event.inputBuffer.getChannelData(0);
        console.log ("input is long: ", inputArray[0].length);
        //console.log ("Channel 1 is long: ", outputArray[1].length);
        var data = inputArray[0];
        this.shifter.process (this.shiftValue, data.length, 4, data);
        
        var out_data = outputArray[0];
        for (i = 0; i < out_data.length; ++i) {
            out_data[i] = this.shifter.outdata[i];
        }
        
    }.bind(this);
    
    this.audioSource.connect (this.processorNode);
    this.processorNode.connect (this.audioDestination);
    
    // The OSC part
    this.OSChandler = args.OSCHandler;
     
    var oscCallback = function (message) {
       console.log (this.id + " received message: ", message);
       var dest = message[0];
       if (dest === this.id + '/bypass/set/') {
           var bypass = message[1];
           if (bypass === true) {
               //TODO
           }
           else if (bypass === false) {
               //TODO
           }
           else {
               console.error ("Bypass value not known: ", bypass);
           }
        }
    };
    
    this.localClient = this.OSChandler.registerClient ({ clientID : this.id,
                                                      oscCallback : oscCallback.bind (this)
                                                    });
    
     // The graphical part
    this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});
    
    this.viewWidth = args.canvas.width;
    this.viewHeight = args.canvas.height;
	
    /* BACKGROUND INIT */
	
    var bg = new K2.Background({
        ID: 'background',
        image: backgroundImage,
        top: 0,
        left: 0
    });

    this.ui.addElement(bg, {zIndex: 0});
    
    /* KNOB INIT */
   var knobArgs = {
        ID: "pitch_knob",
        left: Math.floor ((this.viewWidth - knobImage.width) / 2) ,
        top: Math.floor ((this.viewHeight - knobImage.height) / 2),
        image : knobImage,
        sensitivity : 5000,
        initAngValue: -90,
        startAngValue: 0,
        stopAngValue: 360,
        /* knobMethod: 'updown', */
        onValueSet: function (slot, value) {
            var shift_value = value * (1.5) + 0.5;
            this.shiftValue = shift_value;
            console.log ('Shift value set to ', value, this.shiftValue);
            this.ui.refresh();
        }.bind(this),
        isListening: true
    };
    
    this.ui.addElement(new K2.RotKnob(knobArgs));
    this.ui.setValue({elementID: "pitch_knob", value: 0});
    this.ui.refresh();
  };
  return {
    initPlugin: initPlugin,
    pluginConf: pluginConf
  };
});