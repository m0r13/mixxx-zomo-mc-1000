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

function channelByGroup(group) {
    var matches = group.match(/\[Channel(\d)\]/);
    if (!matches)
        return null;
    return parseInt(matches[1]);
}

MC1000.lastLoop = {};

MC1000.init = function () {
    // turn on all LEDs
    for (var channel = 1; channel <= 2; channel++) {
        for (var i = 0; i <= 40; i++) {
             midi.sendShortMsg(0x90 + channel - 1, i, 0x7f);
        }
        // setPlayLight(channel, PLAY_RED_BLINK);
    }

    connectChannelControl("play", "MC1000.playLED");
    connectChannelControl("hotcue_1_enabled", "MC1000.hotCueLED");
    connectChannelControl("hotcue_2_enabled", "MC1000.hotCueLED");
    connectChannelControl("hotcue_3_enabled", "MC1000.hotCueLED");
};
 
MC1000.shutdown = function() {
    // turn off all LEDs
    for (var channel = 1; channel <= 2; channel++) {
        for (var i = 1; i <= 40; i++) {
             midi.sendShortMsg(0x90 + channel - 1, i, 0x00);
        }
    }
};

MC1000.playLED = function(value, group, control) {
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

MC1000.hotCueLED = function(value, group, control) {
    channel = {"[Channel1]" : 0, "[Channel2]" : 1}[group];
    hotcue = {"hotcue_1_enabled" : 1, "hotcue_2_enabled" : 2, "hotcue_3_enabled" : 3}[control];
    midi.sendShortMsg(0x90 + channel, hotcue, value == 1 ? 0x7f : 0x00);
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
    script.midiDebug(channel, control, value, status, group);
};

