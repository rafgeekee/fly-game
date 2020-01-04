// Set debug mode true to see border around score area
var debugmode = false;

// setting the three states of game - splash screen, scoreboard and game
var states = Object.freeze({
    SplashScreen: 0,
    GameScreen: 1,
    ScoreScreen: 2
});

// Current state will be stored here
var currentstate;

// Global Vars
var gravity = 0.25;
var velocity = 0;
var position = 180;
var rotation = 0;
var jump = -4.6;
var score = 0;
var highscore = 0;
var pipeheight = 90;
var pipewidth = 52;
var pipes = [];
var replayclickable = false;

//sounds
var volume = 30;
var soundJump = new buzz.sound("assets/sounds/sfx_wing.ogg");
var soundScore = new buzz.sound("assets/sounds/sfx_point.ogg");
var soundHit = new buzz.sound("assets/sounds/sfx_hit.ogg");
var soundDie = new buzz.sound("assets/sounds/sfx_die.ogg");
var soundSwoosh = new buzz.sound("assets/sounds/sfx_swooshing.ogg");
buzz.all().setVolume(volume);

//loops
var loopGameloop;
var loopPipeloop;

// Check if debug is on, get high score from cookie - show splash Screen to start
$(document).ready(function() {
    if (window.location.search == "?develop") {
        debugmode = true;
    }

    // Easy hack for noobs
    if (window.location.search == "?noob-mode") {
        pipeheight = 200;
    }

    // If Demo added, run the demo script
    if (window.location.search == "?demo-mode") {
        $.ajax({
            url: 'js/demo-mode.js',
        });

    }

    //get the highscore
    var savedscore = getCookie("highscore");
    if (savedscore !== "") {
        highscore = parseInt(savedscore);
    }

    //start with the splash screen
    showSplash();
});

/**
 * Get cooklie value function
 * @param {String} cname   The name of cookie
 * @return {String}        The Value of named cookie or empty string
 */

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i].trim();
        if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
    }
    return "";
}



/**
 * Sets cookie name, value and expire days
 * @param {String} cname   Name of cookie
 * @param {Number} cvalue  Value of cookie as number - we dont have anything other than highscrore
 * @param {Number} exdays  Number of days to expire
 */

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toGMTString();
    // actually setting the cookie here
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

/**
 * change state to splash screen and show it
 * Nothing to return
 */

function showSplash() {
    // change game state
    currentstate = states.SplashScreen;

    //set the defaults (again)
    velocity = 0;
    position = 180;
    rotation = 0;
    score = 0;

    //update the player in preparation for the next game
    $("#player").css({
        y: 0,
        x: 0
    });
    updatePlayer($("#player"));

    //swoosh sound
    soundSwoosh.stop();
    soundSwoosh.play();

    //clear out all the gates if there are any
    $(".pipe").remove();
    pipes = [];

    //Start animations again
    $(".animated").css('animation-play-state', 'running');
    $(".animated").css('-webkit-animation-play-state', 'running');

    //fade in the splash screen
    $("#splash").transition({
        opacity: 1
    }, 2000, 'ease');
}


/**
 * Change state to game screen and begin game
 * Nothing to return
 */

function startGame() {
    // Change state
    currentstate = states.GameScreen;

    //fade out the splash - never coming from scoreboard screen
    $("#splash").stop();
    $("#splash").transition({
        opacity: 0
    }, 500, 'ease');

    //update the big score
    setBigScore();

    //debug mode?
    if (debugmode) {
        //show the bounding boxes
        $(".boundingbox").show();
    }

    //start up our loops
    var updaterate = 1000.0 / 60.0; //60 times a second
    loopGameloop = setInterval(gameloop, updaterate);
    loopPipeloop = setInterval(updatePipes, 1400);

    //jump from the start!
    playerJump();
}

/**
 * Update players rotation and position
 * Nothing to return
 * @param  {Object} player    jQuery object for player
 */

function updatePlayer(player) {
    //rotation
    rotation = Math.min((velocity / 10) * 90, 90);

    //apply rotation and position
    $(player).css({
        rotate: rotation,
        top: position
    });
}

/**
 * Perform things During the course of the game
 * @return {Null}    If anything is returned - game has ended
 */

function gameloop() {
    // Jquery player object
    var player = $("#player");

    //update the player speed/position
    velocity += gravity;
    position += velocity;

    //declare bounding box
    var boundingbox;

    //update the player
    updatePlayer(player);

    //create the bounding box
    var box = document.getElementById('player').getBoundingClientRect();
    var origwidth = 34.0;
    var origheight = 24.0;

    var boxwidth = origwidth - (Math.sin(Math.abs(rotation) / 90) * 8);
    var boxheight = (origheight + box.height) / 2;
    var boxleft = ((box.width - boxwidth) / 2) + box.left;
    var boxtop = ((box.height - boxheight) / 2) + box.top;
    var boxright = boxleft + boxwidth;
    var boxbottom = boxtop + boxheight;

    //if we're in debug mode, draw the bounding box
    if (debugmode) {
        boundingbox = $("#playerbox");
        boundingbox.css('left', boxleft);
        boundingbox.css('top', boxtop);
        boundingbox.css('height', boxheight);
        boundingbox.css('width', boxwidth);
    }

    //did we hit the ground?
    if (box.bottom >= $("#ground").offset().top) {
        // Player is dead
        playerDead();
        return;
    }

    //have they tried to escape through the ceiling? :o
    var ceiling = $("#ceiling");
    if (boxtop <= (ceiling.offset().top + ceiling.height()))
        position = 0;

    //we can't go any further without a pipe - just to be sure
    if (pipes[0] === null)
        return;

    //determine the bounding box of the next pipes inner area
    var nextpipe = pipes[0];
    var nextpipeupper = nextpipe.children(".pipe_upper");

    var pipetop = nextpipeupper.offset().top + nextpipeupper.height();
    var pipeleft = nextpipeupper.offset().left - 2; // for some reason it starts at the inner pipes offset, not the outer pipes.
    var piperight = pipeleft + pipewidth;
    var pipebottom = pipetop + pipeheight;

    // if debug on, show pipe box
    if (debugmode) {
        boundingbox = $("#pipebox");
        boundingbox.css('left', pipeleft);
        boundingbox.css('top', pipetop);
        boundingbox.css('height', pipeheight);
        boundingbox.css('width', pipewidth);
    }

    //have we gotten inside the pipe yet?
    if (boxright > pipeleft) {
        //we're within the pipe, have we passed between upper and lower pipes?
        if (boxtop > pipetop && boxbottom < pipebottom) {
            //yeah! we're within bounds - you shall pass
        } else {
            //no! we touched the pipe
            playerDead();
            return;
        }
    }


    //have we passed the pipe
    if (boxleft > piperight) {
        //yes, remove it - no need for it in memory
        pipes.splice(0, 1);

        //and score a point
        playerScore();
    }
}

//Handle space bar - Awesome with Makey Makey - Thanks James :)
$(document).keydown(function(e) {
    //space bar!
    if (e.keyCode == 32) {
        //in ScoreScreen, hitting space should click the "replay" button. else it's just a regular spacebar hit
        if (currentstate == states.ScoreScreen)
            $("#replay").click();
        else
            screenClick();
    }
});

//Handle mouse down OR touch start
if ("ontouchstart" in window)
    $(document).on("touchstart", screenClick);
else
    $(document).on("mousedown", screenClick);

/**
 * Different behaviour for different screens - so handle this
 * Nothing to return
 */

function screenClick() {
    if (currentstate == states.GameScreen) {
        playerJump();
    } else if (currentstate == states.SplashScreen) {
        startGame();
    }
}

/**
 * Make the player Jump
 * Nothing to return
 */

function playerJump() {
    velocity = jump;
    //play jump sound
    soundJump.stop();
    soundJump.play();
}

function setBigScore(erase) {
    var elemscore = $("#bigscore");
    elemscore.empty();

    if (erase)
        return;

    var digits = score.toString().split('');
    for (var i = 0; i < digits.length; i++)
        elemscore.append("<img src='assets/fonts/font_big_" + digits[i] + ".png' alt='" + digits[i] + "'>");
}

function setSmallScore() {
    var elemscore = $("#currentscore");
    elemscore.empty();

    var digits = score.toString().split('');
    for (var i = 0; i < digits.length; i++)
        elemscore.append("<img src='assets/fonts/font_small_" + digits[i] + ".png' alt='" + digits[i] + "'>");
}

function setHighScore() {
    var elemscore = $("#highscore");
    elemscore.empty();

    var digits = highscore.toString().split('');
    for (var i = 0; i < digits.length; i++)
        elemscore.append("<img src='assets/fonts/font_small_" + digits[i] + ".png' alt='" + digits[i] + "'>");
}

function setMedal() {
    var elemmedal = $("#medal");
    elemmedal.empty();

    if (score < 10)
    //signal that no medal has been won
        return false;

    if (score >= 10)
        medal = "bronze";
    if (score >= 20)
        medal = "silver";
    if (score >= 30)
        medal = "gold";
    if (score >= 40)
        medal = "platinum";

    elemmedal.append('<img src="assets/medal_' + medal + '.png" alt="' + medal + '">');

    //signal that a medal has been won
    return true;
}

/**
 * Player has died, Stop all animations, Drop orange to floor, clean mem, show scoreboard and set state
 * @return {[type]}
 */

function playerDead() {
    //stop animating everything!
    $(".animated").css('animation-play-state', 'paused');
    $(".animated").css('-webkit-animation-play-state', 'paused');

    //drop the orange to the floor
    var playerbottom = $("#player").position().top + $("#player").width(); //we use width because he'll be rotated 90 deg
    var floor = $("#flyarea").height();
    var movey = Math.max(0, floor - playerbottom);
    $("#player").transition({
        y: movey + 'px',
        rotate: 90
    }, 1000, 'easeInOutCubic');

    //it's time to change states to scoreboard screen
    currentstate = states.ScoreScreen;

    //destroy our gameloops - nothing needed anymore
    clearInterval(loopGameloop);
    clearInterval(loopPipeloop);
    loopGameloop = null;
    loopPipeloop = null;

    //mobile browsers don't support buzz bindOnce event
    if (isIncompatible.any()) {
        //skip right to showing score
        showScore();
    } else {
        //play the hit sound (then the dead sound) and then show score
        soundHit.play().bindOnce("ended", function() {
            soundDie.play().bindOnce("ended", function() {
                showScore();
            });
        });
    }
}

/**
 * Display the scoreboard
 * Nothing to return
 */

function showScore() {
    //unhide
    $("#scoreboard").css("display", "block");

    //remove the big score
    setBigScore(true);

    // Set log entry - retrieve first - push - add back in

        // D3
        var retrievedObject = localStorage.getItem('scoresLog');
         if(retrievedObject != null){
            var data = JSON.parse(retrievedObject);
        } else {
            var data = [];
        }
        data.push(score);
        localStorage.setItem('scoresLog', JSON.stringify(data));

        // Google
        var retrievedObject = localStorage.getItem('scoresLogGoogle');
        if(retrievedObject != null){
            var dataArray = JSON.parse(retrievedObject);
        } else {
            var dataArray = [['Attempt','Score']];
        }
        var index = dataArray.length.toString();
        var scroreArray = [index, score];
        dataArray.push(scroreArray);
        localStorage.setItem('scoresLogGoogle', JSON.stringify(dataArray));



    //have they beaten their high score?
    if (score > highscore) {
        //yeah!
        highscore = score;
        //save it!
        setCookie("highscore", highscore, 999);
    }

    //update the scoreboard
    setSmallScore();
    setHighScore();
    var wonmedal = setMedal();

    //SWOOSH!
    soundSwoosh.stop();
    soundSwoosh.play();

    //show the scoreboard
    $("#scoreboard").css({
        y: '40px',
        opacity: 0
    }); //move it down so we can slide it up
    $("#replay").css({
        y: '40px',
        opacity: 0
    });
    $("#scoreboard").transition({
        y: '0px',
        opacity: 1
    }, 600, 'ease', function() {
        //When the animation is done, animate in the replay button and SWOOSH!
        soundSwoosh.stop();
        soundSwoosh.play();
        $("#replay").transition({
            y: '0px',
            opacity: 1
        }, 600, 'ease');

        //also animate in the MEDAL! WOO!
        if (wonmedal) {
            $("#medal").css({
                scale: 2,
                opacity: 0
            });
            $("#medal").transition({
                opacity: 1,
                scale: 1
            }, 1200, 'ease');
        }
    });

    //make the replay button clickable
    replayclickable = true;
}

$("#replay").click(function() {
    //make sure we can only click once
    if (!replayclickable)
        return;
    else
        replayclickable = false;
    //SWOOSH!
    soundSwoosh.stop();
    soundSwoosh.play();

    //fade out the scoreboard
    $("#scoreboard").transition({
        y: '-40px',
        opacity: 0
    }, 1000, 'ease', function() {
        //when that's done, display us back to nothing
        $("#scoreboard").css("display", "none");

        //start the game over!
        showSplash();
    });
});

function playerScore() {
    score += 1;
    //play score sound
    soundScore.stop();
    soundScore.play();
    setBigScore();
}

function updatePipes() {
    //Do any pipes need removal?
    $(".pipe").filter(function() {
        return $(this).position().left <= -50;
    }).remove();

    var windowHeight = $('#flyarea').height();

    //add a new pipe and put it in the tracker
    var padding = (windowHeight / 100) * 35;
    var constraint = windowHeight - pipeheight - (padding * 2); //double padding (for top and bottom)
    var topheight = Math.floor((Math.random() * constraint) + padding); //add lower padding
    var bottomheight = (windowHeight - pipeheight) - topheight;
    var newpipe = $('<div class="pipe animated"><div class="pipe_upper" style="height: ' + topheight + 'px;"></div><div class="pipe_lower" style="height: ' + bottomheight + 'px;"></div></div>');
    $("#flyarea").append(newpipe);
    pipes.push(newpipe);
}

var isIncompatible = {
    Android: function() {
        return navigator.userAgent.match(/Android/i);
    },
    BlackBerry: function() {
        return navigator.userAgent.match(/BlackBerry/i);
    },
    iOS: function() {
        return navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    Opera: function() {
        return navigator.userAgent.match(/Opera Mini/i);
    },
    Safari: function() {
        return (navigator.userAgent.match(/OS X.*Safari/) && !navigator.userAgent.match(/Chrome/));
    },
    Windows: function() {
        return navigator.userAgent.match(/IEMobile/i);
    },
    any: function() {
        return (isIncompatible.Android() || isIncompatible.BlackBerry() || isIncompatible.iOS() || isIncompatible.Opera() || isIncompatible.Safari() || isIncompatible.Windows());
    }
};
