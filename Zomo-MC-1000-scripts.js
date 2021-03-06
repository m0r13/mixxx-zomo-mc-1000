function MC1000() {};

KEYS = {
    "play" : 0x0E,
    "sync" : 0x0F,
    "cue1" : 0x01,
    "cue2" : 0x02,
    "cue3" : 0x03,
};

LIGHTS = {
    "play_paused" : 0x00,
    "play_playing" : 0x01,
}

PLAY_GREEN = 1;
PLAY_RED = 2;
PLAY_RED_BLINK = 3;

function setPlayLight(channel, value) {
    var green = value == PLAY_GREEN;
    var blink = value == PLAY_RED_BLINK;
    midi.sendShortMsg(0x90 + channel - 1, 0x10, blink ? 0x7f : 0);
    midi.sendShortMsg(0x90 + channel - 1, 0x0E, green ? 0x7f : 0);
}

function connectControl(group, control, handler) {
    engine.connectControl(group, control, handler);
    engine.trigger(group, control);
}

function connectChannelControl(control, handler) {
    for (var channel = 1; channel <= 2; channel++)
        connectControl("[Channel" + channel + "]", control, handler);
}

function setSoftTakeover(control, enabled) {
    for (var channel = 1; channel <= 2; channel++) {
        engine.softTakeover("[Channel" + channel + "]", control, true);
    }
}

function channelByGroup(group) {
    var matches = group.match(/\[Channel(\d)\]/);
    if (!matches)
        return null;
    return parseInt(matches[1]);
}

MC1000.lastLoop = {};

var PITCH_PITCH = false;
var PITCH_SEEK = true;
MC1000.pitchMode = {
    "[Channel1]" : PITCH_SEEK,
    "[Channel2]" : PITCH_SEEK,
};

MC1000.init = function () {
    // turn on all LEDs
    for (var channel = 1; channel <= 2; channel++) {
        for (var i = 0; i <= 40; i++) {
             midi.sendShortMsg(0x90 + channel - 1, i, 0x7f);
        }
        // setPlayLight(channel, PLAY_RED_BLINK);
    }

    midi.sendShortMsg(0x90, 0x04, MC1000.pitchMode["[Channel1]"]);
    midi.sendShortMsg(0x91, 0x07, MC1000.pitchMode["[Channel2]"]);

    connectChannelControl("filterLowKill", "MC1000.handleFilterKill");
    connectChannelControl("filterMidKill", "MC1000.handleFilterKill");
    connectChannelControl("filterHighKill", "MC1000.handleFilterKill");
    connectChannelControl("pfl", "MC1000.handleHeadphoneCue");
    connectChannelControl("play", "MC1000.handlePlayControl");
//    connectChannelControl("loop_enabled", "MC1000.handleLoopEnabledControl");
    connectChannelControl("hotcue_1_enabled", "MC1000.handleHotcueEnabledControl");
    connectChannelControl("hotcue_2_enabled", "MC1000.handleHotcueEnabledControl");
    connectChannelControl("hotcue_3_enabled", "MC1000.handleHotcueEnabledControl");

    setSoftTakeover("volume", true);
    setSoftTakeover("filterLow", true);
    setSoftTakeover("filterMid", true);
    setSoftTakeover("filterHigh", true);
};
 
MC1000.shutdown = function() {
    // turn off all LEDs
    for (var channel = 1; channel <= 2; channel++) {
        for (var i = 1; i <= 40; i++) {
             midi.sendShortMsg(0x90 + channel - 1, i, 0x00);
        }
    }
};

MC1000.handlePlayControl = function(value, group, control) {
    var channel = channelByGroup(group);
    light = value ? PLAY_GREEN : PLAY_RED;
    // red/green play button for playing/not playing
    setPlayLight(channel, light);
    // light the "load track into deck a/b" button only if there is no track playing
    if (channel == 1 || channel == 2) {
        var loadControl = channel == 1 ? 0x09 : 0x19;
        midi.sendShortMsg(0x90, loadControl, !value);
    }
};

MC1000.handleFilterKill = function(value, group, control) {
    var channel = channelByGroup(group);
    if (channel > 2)
        return;
    var eq = 0;
    if (control == "filterLowKill")
        eq = 1;
    else if (control == "filterMidKill")
        eq = 2;
    else if (control == "filterHighKill")
        eq = 3;
    else
        return;
    var setControl = 0x4 + eq;
    if (channel == 2)
        setControl--;
    midi.sendShortMsg(0x8F + channel, setControl, value);
};

MC1000.handleHeadphoneCue = function(value, group, control) {
    var channel = channelByGroup(group);
    if (channel > 2)
        return;
    var setControl = channel == 1 ? 0x0B : 0x1B;
    midi.sendShortMsg(0x90, setControl, value);
};

MC1000.handleLoopEnabledControl = function(value, group, control) {
    var channel = channelByGroup(group);
    var control = channel == 1 ? 0x05 : 0x04;
    midi.sendShortMsg(0x8F + channel, control, value);
};

MC1000.handleHotcueEnabledControl = function(value, group, control) {
    var channel = channelByGroup(group);
    var hotcue = {"hotcue_1_enabled" : 1, "hotcue_2_enabled" : 2, "hotcue_3_enabled" : 3}[control];
    midi.sendShortMsg(0x8F + channel, hotcue, value == 1 ? 0x7f : 0x00);
};

MC1000.effectParameterKnob = function(channel, control, value, status, group) {
    script.midiDebug(channel, control, value, status, group);
    var knobNumber = control;
    var channelNumber = channelByGroup(group);
    var setControl = "";
    if (channelNumber == 1) {
        if (knobNumber == 1)
            setControl = "volume";
        else if (knobNumber == 2)
            setControl = "filterLow";
        else if (knobNumber == 3)
            setControl = "filterMid";
        else if (knobNumber == 4)
            setControl = "filterHigh";
    } else if (channelNumber == 2) {
        if (knobNumber == 1)
            setControl = "filterLow";
        else if (knobNumber == 2)
            setControl = "filterMid";
        else if (knobNumber == 3)
            setControl = "filterHigh";
        else if (knobNumber == 4)
            setControl = "volume";
    } else {
        return;
    }
    if (setControl.substr(0, 6) == "filter")
        value = script.absoluteNonLin(value, 0.0, 1.0, 4.0);
    else
        value = script.absoluteLin(value, 0.0, 1.0);
    engine.setValue(group, setControl, value);
};

MC1000.effectParameterButton = function(channel, control, value, status, group) {
    if (value != 0x7F)
        return;
    var buttonNumber = control - 0x3;
    var channelNumber = channelByGroup(group);
    var setControl = "";
    if (channelNumber == 1) {
        if (buttonNumber == 1) {
            var mode = MC1000.pitchMode[group];
            midi.sendShortMsg(0x90 + channelByGroup(group) - 1, control, !mode);
            MC1000.pitchMode[group] = !mode;
            return;
        } else if (buttonNumber == 2)
            setControl = "filterLowKill";
        else if (buttonNumber == 3)
            setControl = "filterMidKill";
        else if (buttonNumber == 4)
            setControl = "filterHighKill";
    } else if (channelNumber == 2) {
        if (buttonNumber == 1)
            setControl = "filterLowKill";
        else if (buttonNumber == 2)
            setControl = "filterMidKill";
        else if (buttonNumber == 3)
            setControl = "filterHighKill";
        else if (buttonNumber == 4) {
            var mode = MC1000.pitchMode[group];
            midi.sendShortMsg(0x90 + channelByGroup(group) - 1, control, !mode);
            MC1000.pitchMode[group] = !mode;
            return;
        }
    } else {
        return;
    }

    var killed = engine.getValue(group, setControl);
    engine.setValue(group, setControl, !killed);
};

LOOPS = [0.03125, 0.0625, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];

function currentLoop(group) {
    for (var i in LOOPS)
        if (engine.getValue(group, "beatloop_" + LOOPS[i] + "_enabled"))
            return LOOPS[i];
    return 0;
}

MC1000.loopKnob = function(channel, control, value, status, group) {
    var loop = currentLoop(group);
    if (loop == 0)
        return;
    if (value == 0x3F) {
        engine.setValue(group, "loop_halve", true);
        engine.setValue(group, "loop_halve", false);
        loop /= 2;
    } else /*if (value == 0x41)*/ {
        engine.setValue(group, "loop_double", true);
        engine.setValue(group, "loop_double", false);
        loop *= 2;
    }
    MC1000.lastLoop[group] = loop;
    print("new loop: " + loop);
};

MC1000.loopKnobPress = function(channel, control, value, status, group) {
    if (value != 0x7F)
        return;
    var loop = currentLoop(group);
    if (loop == 0) {
        loop = 4;
        if (group in MC1000.lastLoop)
            loop = MC1000.lastLoop[group];
    }
    print("loop press: " + loop);
    engine.setValue(group, "beatloop_" + loop + "_toggle", true);
    engine.setValue(group, "beatloop_" + loop + "_toggle", false);
};

MC1000.effectSelectKnob = function(channel, control, value, status, group) {
    if (value != 0x3F && value != 0x41)
        return;
    var loop = currentLoop(group);
    if (loop == 0)
        return;
    var direction = value == 0x3F ? "backward" : "forward";
    engine.setValue(group, "loop_move_" + loop + "_" + direction, true);
    engine.setValue(group, "loop_move_" + loop + "_" + direction, false);
};

MC1000.filterKnob = function(channel, control, value, status, group) {
    script.midiDebug(channel, control, value, status, group);
    engine.setValue(group, "super1", script.absoluteLin(value, 0.0, 1.0));
    // script.absoluteNonLin(value, 0.4, 0.707106781, 4.0, 0, 127)
};

MC1000.pitch = function(channel, control, value, status, group) {
    var mode = MC1000.pitchMode[group];
    var more = control == 0x0C && value == 0x7F;
    var less = control == 0x0D && value == 0x7F;
    if (mode == PITCH_SEEK) {
        if (less) {
            engine.setValue(group, "back", true);
        } else if (more) {
            engine.setValue(group, "fwd", true);
        } else {
            engine.setValue(group, "back", false);
            engine.setValue(group, "fwd", false);
        }
    } else if (mode == PITCH_PITCH) {
        // rate_temp_up/down
        if (less) {
            /*
            print("less");
            engine.setValue(group, "rate_perm_down_small", true);
            engine.setValue(group, "rate_perm_down_small", false);
            */
            engine.setValue(group, "rate_temp_up", false);
            engine.setValue(group, "rate_temp_down", true);
        } else if (more) {
            /*
            print("more");
            engine.setValue(group, "rate_perm_up_small", true);
            engine.setValue(group, "rate_perm_up_small", false);
            */
            engine.setValue(group, "rate_temp_up", true);
            engine.setValue(group, "rate_temp_down", false);
        } else {
            //print("reset");
            engine.setValue(group, "rate_temp_up", false);
            engine.setValue(group, "rate_temp_down", false);
        }
    }
};

