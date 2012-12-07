define(['kievII'], function() {
  var pluginConf = {
      osc: true,
      audioIn: true,
      audioOut: true,
      canvas: {
          width: 450,
          height: 300
      },
  }
  var initPlugin = function(args) {
    // Inspired from BBC Ring Modulator: http://webaudio.prototyping.bbc.co.uk/ring-modulator/
    console.log ("plugin inited, args is", args, "KievII object is ", K2);
    
    this.name = args.name;
    
    // The sound part
    this.audioSource = args.audioSource;
    this.audioDestination = args.audioDestination;
    this.context = args.audioContext;
    var context = this.context;
    
    DiodeNode = (function() {
    
        function DiodeNode(context) {  
            this.context = context;
            this.node = this.context.createWaveShaper();
            this.vb = 0.2;
            this.vl = 0.4;
            this.h = 1;
            this.setCurve(); 
          }

        DiodeNode.prototype.setDistortion = function(distortion) {
            this.h = distortion;
            return this.setCurve();
        };

        DiodeNode.prototype.setCurve = function() {
          var i, samples, v, value, wsCurve, _i, _ref;
          samples = 1024;
          wsCurve = new Float32Array(samples);
          for (i = _i = 0, _ref = wsCurve.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
            v = (i - samples / 2) / (samples / 2);
            v = Math.abs(v);
            if (v <= this.vb) {
              value = 0;
            } else if ((this.vb < v) && (v <= this.vl)) {
              value = this.h * ((Math.pow(v - this.vb, 2)) / (2 * this.vl - 2 * this.vb));
            } else {
              value = this.h * v - this.h * this.vl + (this.h * ((Math.pow(this.vl - this.vb, 2)) / (2 * this.vl - 2 * this.vb)));
            }
            wsCurve[i] = value;
          }
          return this.node.curve = wsCurve;
        };

        DiodeNode.prototype.connect = function(destination) {
          return this.node.connect(destination);
        };
        
        DiodeNode.prototype.getNode = function() {
          return this.node;
        };

        return DiodeNode;

        })();
    
    // Initialize nodes      
    this.vIn = context.createOscillator();
    this.vIn.frequency.value = 4;
    this.vIn.noteOn(0);
    this.vInGain = context.createGainNode();
    this.vInGain.gain.value = 0.5;
    this.vInInverter1 = context.createGainNode();
    this.vInInverter1.gain.value = -1;
    this.vInInverter2 = context.createGainNode();
    this.vInInverter2.gain.value = -1;
    this.vInDiode1 = new DiodeNode(context);
    this.vInDiode2 = new DiodeNode(context);
    this.vInInverter3 = context.createGainNode();
    this.vInInverter3.gain.value = -1;
    this.vcInverter1 = context.createGainNode();
    this.vcInverter1.gain.value = -1;
    this.vcDiode3 = new DiodeNode(context);
    this.vcDiode4 = new DiodeNode(context);
    this.outGain = context.createGainNode();
    this.outGain.gain.value = 4;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    
    // Connect nodes
    this.audioSource.connect(this.vcInverter1);
    this.audioSource.connect(this.vcDiode4.getNode());
    this.vcInverter1.connect(this.vcDiode3.node);
    this.vIn.connect(this.vInGain);
    this.vInGain.connect(this.vInInverter1);
    this.vInGain.connect(this.vcInverter1);
    this.vInGain.connect(this.vcDiode4.node);
    this.vInInverter1.connect(this.vInInverter2);
    this.vInInverter1.connect(this.vInDiode2.node);
    this.vInInverter2.connect(this.vInDiode1.node);
    this.vInDiode1.connect(this.vInInverter3);
    this.vInDiode2.connect(this.vInInverter3);
    this.vInInverter3.connect(this.compressor);
    this.vcDiode3.connect(this.compressor);
    this.vcDiode4.connect(this.compressor);
    this.compressor.connect(this.outGain);
    this.outGain.connect(this.audioDestination);
    
    // The OSC part
    this.OSChandler = args.OSCHandler;
     
    var oscCallback = function (message) {
       console.log (this.name + " received message: ", message);
       var dest = message[0];
       if (dest === this.name + '/bypass/set/') {
           var bypass = message[1];
           if (bypass === true) {
               this.vIn.noteOff(0);
           }
           else if (bypass === false) {
               this.vIn.noteOn(0);
           }
           else {
               console.error ("Bypass value not known: ", bypass);
           }
        }
    };
    
    this.localClient = this.OSChandler.registerClient ({ clientID : this.name,
                                                      oscCallback : oscCallback.bind (this)
                                                    });
    
     // The graphical part
    this.ui = new K2.UI ({type: 'CANVAS2D', target: args.canvas});
    
    this.viewWidth = args.canvas.width;
    this.viewHeight = args.canvas.height;
    
    var freqGaugeArgs = {
            ID : this.name + "freqGauge",
            left : Math.floor(this.viewWidth * 0.5 - this.viewWidth * 0.2),
            top : Math.floor(this.viewHeight * 0.5 - this.viewHeight * 0.2),
            height : 120,
            width : 120,
            onValueSet : function(slot, value) {
                
                /* valueMin: 0 valueMax: 2000 */
                var parValue = value * 2000;
                parValue = parValue.toFixed(2);
                if (Math.abs(this.vIn.frequency.value - parValue) > 0.001) {
                    console.log ("Frequency was ", this.vIn.frequency.value, " set to: ", parValue);
                    this.vIn.frequency.value = parValue;
                    console.log ("Frequency is ", this.vIn.frequency.value, " set to: ", parValue);
                }
                this.ui.refresh();
                
            }.bind(this),
            isListening : true
        };

    this.ui.addElement(new K2.Gauge(freqGaugeArgs));
    this.ui.setValue({
        elementID : this.name + 'freqGauge',
        slot : 'gaugevalue',
        value : 0.0
    });
    this.ui.refresh(); 

    return this;   
  };
  return {
    initPlugin: initPlugin,
    pluginConf: pluginConf
  };
});