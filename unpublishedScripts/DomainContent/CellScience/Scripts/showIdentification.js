//  Copyright 2016 High Fidelity, Inc.
//
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

(function() {

    var self = this;
    var baseURL = "https://hifi-content.s3.amazonaws.com/DomainContent/CellScience/";

    var version = 1;
    this.preload = function(entityId) {
        this.soundPlaying = null;
        this.entityId = entityId;
        self.getUserData();
        this.labelURL = baseURL + "GUI/labels_" + self.userData.name + ".png?" + version;
        this.showDistance = self.userData.showDistance;
        this.soundURL = baseURL + "Audio/" + self.userData.name + ".wav";
        this.soundOptions = {
            stereo: true,
            loop: false,
            localOnly: true,
            volume: 0.035,
            position: this.position
        };
        this.sound = SoundCache.getSound(this.soundURL);
        this.buttonImageURL = baseURL + "GUI/GUI_audio.png?" + version;
        self.addButton();
    }

    this.addButton = function() {
        this.windowDimensions = Controller.getViewportDimensions();
        this.buttonWidth = 100;
        this.buttonHeight = 100;
        this.buttonPadding = 40;

        this.buttonPositionX = (self.windowDimensions.x - self.buttonPadding) / 2 - self.buttonWidth / 2;
        this.buttonPositionY = (self.windowDimensions.y - self.buttonHeight) - (self.buttonHeight + self.buttonPadding);
        this.button = Overlays.addOverlay("image", {
            x: self.buttonPositionX,
            y: self.buttonPositionY,
            width: self.buttonWidth,
            height: self.buttonHeight,
            imageURL: self.buttonImageURL,
            visible: false,
            alpha: 1.0
        });

        this.labelWidth = 256;
        this.labelHeight = 64;
        this.labelPadding = 0;

        this.labelPositionX = (self.windowDimensions.x - self.labelPadding) / 2 - self.labelWidth / 2;
        this.labelPositionY = self.labelHeight + self.labelPadding;
        //  print("adding label " + self.labelURL + " at position " + self.labelPositionX + ", " + self.labelPositionY);
        this.label = Overlays.addOverlay("image", {
            x: self.labelPositionX,
            y: self.labelPositionY,
            width: self.labelWidth,
            height: self.labelHeight,
            imageURL: self.labelURL,
            visible: false,
            alpha: 1.0
        });
    }


    this.getUserData = function() {
        this.properties = Entities.getEntityProperties(this.entityId);
        if (self.properties.userData) {
            this.userData = JSON.parse(this.properties.userData);
        } else {
            this.userData = {};
        }
    }

    this.enterEntity = function(entityID) {

        //      self.getUserData();
        print("entering entity and showing" + self.labelURL);
        //self.buttonShowing = true;
        Overlays.editOverlay(self.button, {
            visible: true
        });
        Overlays.editOverlay(self.label, {
            visible: true
        });
    }



    this.leaveEntity = function(entityID) {
        //      self.getUserData();
        //      print("leaving entity " + self.userData.name);
        //self.buttonShowing = false;
        print(Overlays);
        Overlays.editOverlay(self.button, {
            visible: false
        });
        Overlays.editOverlay(self.label, {
            visible: false
        });
    }

    this.onClick = function(event) {
        var clickedOverlay = Overlays.getOverlayAtPoint({
            x: event.x,
            y: event.y
        });
        if (clickedOverlay == self.button) {
            print("button was clicked");
            if (self.sound.downloaded) {
                print("play sound");

                Overlays.editOverlay(self.button, {
                    visible: false
                });
                this.soundPlaying = Audio.playSound(self.sound, self.soundOptions);
            } else {
                print("not downloaded");
            }
        }
    }

    this.unload = function() {
        Overlays.deleteOverlay(self.button);
        if (this.soundPlaying !== null) {
            this.soundPlaying.stop();
        }

        Controller.mousePressEvent.disconnect(this.onClick);
    }

    Controller.mousePressEvent.connect(this.onClick);

});