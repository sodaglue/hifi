//  grab.js
//  examples
//
//  Created by Eric Levin on May 1, 2015
//  Copyright 2015 High Fidelity, Inc.
//
//  Grab's physically moveable entities with the mouse, by applying a spring force.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//
/*global print, Mouse, MyAvatar, Entities, AnimationCache, SoundCache, Scene, Camera, Overlays, Audio, HMD, AvatarList, AvatarManager, Controller, UndoStack, Window, Account, GlobalServices, Script, ScriptDiscoveryService, LODManager, Menu, Vec3, Quat, AudioDevice, Paths, Clipboard, Settings, XMLHttpRequest, randFloat, randInt, pointInExtents, vec3equal, setEntityCustomData, getEntityCustomData */

Script.include("libraries/utils.js");
// objects that appear smaller than this can't be grabbed
var MAX_SOLID_ANGLE = 0.01;

var ZERO_VEC3 = {
    x: 0,
    y: 0,
    z: 0
};
var IDENTITY_QUAT = {
    x: 0,
    y: 0,
    z: 0,
    w: 0
};
var GRABBABLE_DATA_KEY = "grabbableKey"; // shared with handControllerGrab.js
var GRAB_USER_DATA_KEY = "grabKey"; // shared with handControllerGrab.js

var DEFAULT_GRABBABLE_DATA = {
    grabbable: true,
    invertSolidWhileHeld: false
};


var MAX_SOLID_ANGLE = 0.01; // objects that appear smaller than this can't be grabbed
var ZERO_VEC3 = {
    x: 0,
    y: 0,
    z: 0
};
var IDENTITY_QUAT = {
    x: 0,
    y: 0,
    z: 0,
    w: 0
};
var ACTION_TTL = 10; // seconds

function getTag() {
    return "grab-" + MyAvatar.sessionUUID;
}

function entityIsGrabbedByOther(entityID) {
    // by convention, a distance grab sets the tag of its action to be grab-*owner-session-id*.
    var actionIDs = Entities.getActionIDs(entityID);
    for (var actionIndex = 0; actionIndex < actionIDs.length; actionIndex++) {
        var actionID = actionIDs[actionIndex];
        var actionArguments = Entities.getActionArguments(entityID, actionID);
        var tag = actionArguments["tag"];
        if (tag == getTag()) {
            // we see a grab-*uuid* shaped tag, but it's our tag, so that's okay.
            continue;
        }
        if (tag.slice(0, 5) == "grab-") {
            // we see a grab-*uuid* shaped tag and it's not ours, so someone else is grabbing it.
            return true;
        }
    }
    return false;
}

// helper function
function mouseIntersectionWithPlane(pointOnPlane, planeNormal, event, maxDistance) {
    var cameraPosition = Camera.getPosition();
    var localPointOnPlane = Vec3.subtract(pointOnPlane, cameraPosition);
    var distanceFromPlane = Vec3.dot(localPointOnPlane, planeNormal);
    var MIN_DISTANCE_FROM_PLANE = 0.001;
    if (Math.abs(distanceFromPlane) < MIN_DISTANCE_FROM_PLANE) {
        // camera is touching the plane
        return pointOnPlane;
    }
    var pickRay = Camera.computePickRay(event.x, event.y);
    var dirDotNorm = Vec3.dot(pickRay.direction, planeNormal);
    var MIN_RAY_PLANE_DOT = 0.00001;

    var localIntersection;
    var useMaxForwardGrab = false;
    if (Math.abs(dirDotNorm) > MIN_RAY_PLANE_DOT) {
        var distanceToIntersection = distanceFromPlane / dirDotNorm;
        if (distanceToIntersection > 0 && distanceToIntersection < maxDistance) {
            // ray points into the plane
            localIntersection = Vec3.multiply(pickRay.direction, distanceFromPlane / dirDotNorm);
        } else {
            // ray intersects BEHIND the camera or else very far away
            // so we clamp the grab point to be the maximum forward position
            useMaxForwardGrab = true;
        }
    } else {
        // ray points perpendicular to grab plane
        // so we map the grab point to the maximum forward position
        useMaxForwardGrab = true;
    }
    if (useMaxForwardGrab) {
        // we re-route the intersection to be in front at max distance.
        var rayDirection = Vec3.subtract(pickRay.direction, Vec3.multiply(planeNormal, dirDotNorm));
        rayDirection = Vec3.normalize(rayDirection);
        localIntersection = Vec3.multiply(rayDirection, maxDistance);
        localIntersection = Vec3.sum(localIntersection, Vec3.multiply(planeNormal, distanceFromPlane));
    }
    var worldIntersection = Vec3.sum(cameraPosition, localIntersection);
    return worldIntersection;
}

// Mouse class stores mouse click and drag info
Mouse = function() {
    this.current = {
        x: 0,
        y: 0
    };
    this.previous = {
        x: 0,
        y: 0
    };
    this.rotateStart = {
        x: 0,
        y: 0
    };
    this.cursorRestore = {
        x: 0,
        y: 0
    };
}

Mouse.prototype.startDrag = function(position) {
    this.current = {
        x: position.x,
        y: position.y
    };
    this.startRotateDrag();
}

Mouse.prototype.updateDrag = function(position) {
    this.current = {
        x: position.x,
        y: position.y
    };
}

Mouse.prototype.startRotateDrag = function() {
    this.previous = {
        x: this.current.x,
        y: this.current.y
    };
    this.rotateStart = {
        x: this.current.x,
        y: this.current.y
    };
    this.cursorRestore = {
        x: Window.getCursorPositionX(),
        y: Window.getCursorPositionY()
    };
}

Mouse.prototype.getDrag = function() {
    var delta = {
        x: this.current.x - this.previous.x,
        y: this.current.y - this.previous.y
    };
    this.previous = {
        x: this.current.x,
        y: this.current.y
    };
    return delta;
}

Mouse.prototype.restoreRotateCursor = function() {
    Window.setCursorPosition(this.cursorRestore.x, this.cursorRestore.y);
    this.current = {
        x: this.rotateStart.x,
        y: this.rotateStart.y
    };
}

var mouse = new Mouse();


// Beacon class stores info for drawing a line at object's target position
Beacon = function() {
    this.height = 0.10;
    this.overlayID = Overlays.addOverlay("line3d", {
        color: {
            red: 200,
            green: 200,
            blue: 200
        },
        alpha: 1,
        visible: false,
        lineWidth: 2
    });
}

Beacon.prototype.enable = function() {
    Overlays.editOverlay(this.overlayID, {
        visible: true
    });
}

Beacon.prototype.disable = function() {
    Overlays.editOverlay(this.overlayID, {
        visible: false
    });
}

Beacon.prototype.updatePosition = function(position) {
    Overlays.editOverlay(this.overlayID, {
        visible: true,
        start: {
            x: position.x,
            y: position.y + this.height,
            z: position.z
        },
        end: {
            x: position.x,
            y: position.y - this.height,
            z: position.z
        }
    });
}

var beacon = new Beacon();


// TODO: play sounds again when we aren't leaking AudioInjector threads
// var grabSound = SoundCache.getSound("https://hifi-public.s3.amazonaws.com/eric/sounds/CloseClamp.wav");
// var releaseSound = SoundCache.getSound("https://hifi-public.s3.amazonaws.com/eric/sounds/ReleaseClamp.wav");
// var VOLUME = 0.0;


// Grabber class stores and computes info for grab behavior
Grabber = function() {
    this.isGrabbing = false;
    this.entityID = null;
    this.actionID = null;
    this.startPosition = ZERO_VEC3;
    this.lastRotation = IDENTITY_QUAT;
    this.currentPosition = ZERO_VEC3;
    this.planeNormal = ZERO_VEC3;

    // maxDistance is a function of the size of the object.
    this.maxDistance;

    // mode defines the degrees of freedom of the grab target positions
    // relative to startPosition options include:
    //     xzPlane  (default)
    //     verticalCylinder  (SHIFT)
    //     rotate  (CONTROL)
    this.mode = "xzplane";

    // offset allows the user to grab an object off-center.  It points from the object's center
    // to the point where the ray intersects the grab plane (at the moment the grab is initiated).
    // Future target positions of the ray intersection are on the same plane, and the offset is subtracted
    // to compute the target position of the object's center.
    this.offset = {
        x: 0,
        y: 0,
        z: 0
    };

    this.targetPosition;
    this.targetRotation;

    this.liftKey = false; // SHIFT
    this.rotateKey = false; // CONTROL
}

Grabber.prototype.computeNewGrabPlane = function() {
    if (!this.isGrabbing) {
        return;
    }

    var modeWasRotate = (this.mode == "rotate");
    this.mode = "xzPlane";
    this.planeNormal = {
        x: 0,
        y: 1,
        z: 0
    };
    if (this.rotateKey) {
        this.mode = "rotate";
        mouse.startRotateDrag();
    } else {
        if (modeWasRotate) {
            // we reset the mouse screen position whenever we stop rotating
            mouse.restoreRotateCursor();
        }
        if (this.liftKey) {
            this.mode = "verticalCylinder";
            // NOTE: during verticalCylinder mode a new planeNormal will be computed each move
        }
    }

    this.pointOnPlane = Vec3.sum(this.currentPosition, this.offset);
    var xzOffset = Vec3.subtract(this.pointOnPlane, Camera.getPosition());
    xzOffset.y = 0;
    this.xzDistanceToGrab = Vec3.length(xzOffset);
}

Grabber.prototype.pressEvent = function(event) {
    if (event.isLeftButton!==true ||event.isRightButton===true || event.isMiddleButton===true) {
        return;
    }

    var pickRay = Camera.computePickRay(event.x, event.y);
    var pickResults = Entities.findRayIntersection(pickRay, true); // accurate picking
    if (!pickResults.intersects) {
        // didn't click on anything
        return;
    }

    if (!pickResults.properties.dynamic) {
        // only grab dynamic objects
        return;
    }

    var grabbableData = getEntityCustomData(GRABBABLE_DATA_KEY, pickResults.entityID, DEFAULT_GRABBABLE_DATA);
    if (grabbableData.grabbable === false) {
        return;
    }

    mouse.startDrag(event);

    var clickedEntity = pickResults.entityID;
    var entityProperties = Entities.getEntityProperties(clickedEntity)
    this.startPosition = entityProperties.position;
    this.lastRotation = entityProperties.rotation;
    var cameraPosition = Camera.getPosition();

    var objectBoundingDiameter = Vec3.length(entityProperties.dimensions);
    beacon.height = objectBoundingDiameter;
    this.maxDistance = objectBoundingDiameter / MAX_SOLID_ANGLE;
    if (Vec3.distance(this.startPosition, cameraPosition) > this.maxDistance) {
        // don't allow grabs of things far away
        return;
    }

    this.activateEntity(clickedEntity, entityProperties);
    this.isGrabbing = true;

    this.entityID = clickedEntity;
    this.currentPosition = entityProperties.position;
    this.targetPosition = {
        x: this.startPosition.x,
        y: this.startPosition.y,
        z: this.startPosition.z
    };

    // compute the grab point
    var nearestPoint = Vec3.subtract(this.startPosition, cameraPosition);
    var distanceToGrab = Vec3.dot(nearestPoint, pickRay.direction);
    nearestPoint = Vec3.multiply(distanceToGrab, pickRay.direction);
    this.pointOnPlane = Vec3.sum(cameraPosition, nearestPoint);

    // compute the grab offset (points from object center to point of grab)
    this.offset = Vec3.subtract(this.pointOnPlane, this.startPosition);

    this.computeNewGrabPlane();

    beacon.updatePosition(this.startPosition);

    // TODO: play sounds again when we aren't leaking AudioInjector threads
    //Audio.playSound(grabSound, { position: entityProperties.position, volume: VOLUME });
}

Grabber.prototype.releaseEvent = function(event) {
        if (event.isLeftButton!==true ||event.isRightButton===true || event.isMiddleButton===true) {
        return;
    }

    if (this.isGrabbing) {
        this.deactivateEntity(this.entityID);
        this.isGrabbing = false
        Entities.deleteAction(this.entityID, this.actionID);
        this.actionID = null;

        beacon.disable();

        // TODO: play sounds again when we aren't leaking AudioInjector threads
        //Audio.playSound(releaseSound, { position: entityProperties.position, volume: VOLUME });
    }
}

Grabber.prototype.moveEvent = function(event) {
    if (!this.isGrabbing) {
        return;
    }
    mouse.updateDrag(event);

    // see if something added/restored gravity
    var entityProperties = Entities.getEntityProperties(this.entityID);
    if (Vec3.length(entityProperties.gravity) != 0) {
        this.originalGravity = entityProperties.gravity;
    }
    this.currentPosition = entityProperties.position;

    var actionArgs = {
        tag: getTag(),
        ttl: ACTION_TTL
    };

    if (this.mode === "rotate") {
        var drag = mouse.getDrag();
        var orientation = Camera.getOrientation();
        var dragOffset = Vec3.multiply(drag.x, Quat.getRight(orientation));
        dragOffset = Vec3.sum(dragOffset, Vec3.multiply(-drag.y, Quat.getUp(orientation)));
        var axis = Vec3.cross(dragOffset, Quat.getFront(orientation));
        axis = Vec3.normalize(axis);
        var ROTATE_STRENGTH = 0.4; // magic number tuned by hand
        var angle = ROTATE_STRENGTH * Math.sqrt((drag.x * drag.x) + (drag.y * drag.y));
        var deltaQ = Quat.angleAxis(angle, axis);
        // var qZero = entityProperties.rotation;
        //var qZero = this.lastRotation;
        this.lastRotation = Quat.multiply(deltaQ, this.lastRotation);

        actionArgs = {
            targetRotation: this.lastRotation,
            angularTimeScale: 0.1,
            tag: getTag(),
            ttl: ACTION_TTL
        };

    } else {
        var newPointOnPlane;
        if (this.mode === "verticalCylinder") {
            // for this mode we recompute the plane based on current Camera
            var planeNormal = Quat.getFront(Camera.getOrientation());
            planeNormal.y = 0;
            planeNormal = Vec3.normalize(planeNormal);
            var pointOnCylinder = Vec3.multiply(planeNormal, this.xzDistanceToGrab);
            pointOnCylinder = Vec3.sum(Camera.getPosition(), pointOnCylinder);
            this.pointOnPlane = mouseIntersectionWithPlane(pointOnCylinder, planeNormal, mouse.current, this.maxDistance);
            newPointOnPlane = {
                x: this.pointOnPlane.x,
                y: this.pointOnPlane.y,
                z: this.pointOnPlane.z
            };
        } else {
            var cameraPosition = Camera.getPosition();
            newPointOnPlane = mouseIntersectionWithPlane(this.pointOnPlane, this.planeNormal, mouse.current, this.maxDistance);
            var relativePosition = Vec3.subtract(newPointOnPlane, cameraPosition);
            var distance = Vec3.length(relativePosition);
            if (distance > this.maxDistance) {
                // clamp distance
                relativePosition = Vec3.multiply(relativePosition, this.maxDistance / distance);
                newPointOnPlane = Vec3.sum(relativePosition, cameraPosition);
            }
        }
        this.targetPosition = Vec3.subtract(newPointOnPlane, this.offset);

        actionArgs = {
            targetPosition: this.targetPosition,
            linearTimeScale: 0.1,
            tag: getTag(),
            ttl: ACTION_TTL
        };


        beacon.updatePosition(this.targetPosition);
    }

    if (!this.actionID) {
        if (!entityIsGrabbedByOther(this.entityID)) {
            this.actionID = Entities.addAction("spring", this.entityID, actionArgs);
        }
    } else {
        Entities.updateAction(this.entityID, this.actionID, actionArgs);
    }
}

Grabber.prototype.keyReleaseEvent = function(event) {
    if (event.text === "SHIFT") {
        this.liftKey = false;
    }
    if (event.text === "CONTROL") {
        this.rotateKey = false;
    }
    this.computeNewGrabPlane();
}

Grabber.prototype.keyPressEvent = function(event) {
    if (event.text === "SHIFT") {
        this.liftKey = true;
    }
    if (event.text === "CONTROL") {
        this.rotateKey = true;
    }
    this.computeNewGrabPlane();
}

Grabber.prototype.activateEntity = function(entityID, grabbedProperties) {
    var grabbableData = getEntityCustomData(GRABBABLE_DATA_KEY, entityID, DEFAULT_GRABBABLE_DATA);
    var invertSolidWhileHeld = grabbableData["invertSolidWhileHeld"];
    var data = getEntityCustomData(GRAB_USER_DATA_KEY, entityID, {});
    data["activated"] = true;
    data["avatarId"] = MyAvatar.sessionUUID;
    data["refCount"] = data["refCount"] ? data["refCount"] + 1 : 1;
    // zero gravity and set collisionless to true, but in a way that lets us put them back, after all grabs are done
    if (data["refCount"] == 1) {
        data["gravity"] = grabbedProperties.gravity;
        data["collisionless"] = grabbedProperties.collisionless;
        data["dynamic"] = grabbedProperties.dynamic;
        var whileHeldProperties = {gravity: {x:0, y:0, z:0}};
        if (invertSolidWhileHeld) {
            whileHeldProperties["collisionless"] = ! grabbedProperties.collisionless;
        }
        Entities.editEntity(entityID, whileHeldProperties);
    }
    setEntityCustomData(GRAB_USER_DATA_KEY, entityID, data);
};

Grabber.prototype.deactivateEntity = function(entityID) {
    var data = getEntityCustomData(GRAB_USER_DATA_KEY, entityID, {});
    if (data && data["refCount"]) {
        data["refCount"] = data["refCount"] - 1;
        if (data["refCount"] < 1) {
            Entities.editEntity(entityID, {
                gravity: data["gravity"],
                collisionless: data["collisionless"],
                dynamic: data["dynamic"]
            });
            data = null;
        }
    } else {
        data = null;
    }
    setEntityCustomData(GRAB_USER_DATA_KEY, entityID, data);
};



var grabber = new Grabber();

function pressEvent(event) {
    grabber.pressEvent(event);
}

function moveEvent(event) {
    grabber.moveEvent(event);
}

function releaseEvent(event) {
    grabber.releaseEvent(event);
}

function keyPressEvent(event) {
    grabber.keyPressEvent(event);
}

function keyReleaseEvent(event) {
    grabber.keyReleaseEvent(event);
}

Controller.mousePressEvent.connect(pressEvent);
Controller.mouseMoveEvent.connect(moveEvent);
Controller.mouseReleaseEvent.connect(releaseEvent);
Controller.keyPressEvent.connect(keyPressEvent);
Controller.keyReleaseEvent.connect(keyReleaseEvent);
