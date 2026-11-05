/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
 *
 * This code is released under the GNU GPL v3, with some additional terms.
 * Please see the files LICENSE and COPYING for details. Alternatively,
 * consult http://micropolisjs.graememcc.co.uk/LICENSE and
 * http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
 *
 */

import $ from "jquery";

import { Config } from './config.js';
import { Game } from './game.js';
import { MapGenerator } from './mapGenerator.js';
import { Simulation } from './simulation.js';
import { SplashCanvas } from './splashCanvas.js';
import { Storage } from './storage.js';

/*
 *
 * The SplashScreen is the first screen the player will see on launch. It is responsible for map generation,
 * placing UI on screen to allow the player to select a map or load a game, and finally launching the game.
 * This should not be called until the tiles and sprites have been loaded.
 *
 */

var onresize = null;


// If the window is initially too small, try and relaunch if it gets bigger
var makeResizeListener = function(tileSet, spriteSheet) {
  return function(tileSet, spriteSheet, e) {
    $(window).off('resize');
    var s = new SplashScreen(tileSet, spriteSheet);
  }.bind(null, tileSet, spriteSheet);
};


function SplashScreen(tileSet, snowTileSet, spriteSheet) {
  // We don't launch the game if the screen is too small, however, we should retain the right to do so
  // should the situation change...
  if ($('#tooSmall').is(':visible')) {
    onresize = makeResizeListener(tileSet, spriteSheet);
    $(window).on('resize', onresize);
    return;
  }

  this.tileSet = tileSet;
  this.snowTileSet = snowTileSet;
  this.spriteSheet = spriteSheet;
  this.map = MapGenerator();

  // Aftersight: Festus starts in one click (its map, name and tuning are fixed); the sandbox (a random map or an
  // empty valley) gets the name, difficulty and map form; a saved game (the game saves itself) can be continued.
  $('#splashFestus').click(playFestus.bind(this));
  $('#splashSandbox').click(acquireNameAndDifficulty.bind(this));
  $('#splashGenerate').click(regenerateMap.bind(this));
  $('#splashBack').click(backToSplash.bind(this));
  $('#splashLoad').click(handleLoad.bind(this));
  $('#playForm').submit(play.bind(this));
  // the start screen's About opens AfterSight's own About window (the game wires it up again once it starts)
  $('#splashAbout').on('click.splash', function(e) { e.preventDefault(); $('#opaque, #aboutWindow').removeClass('hidden'); });
  $('#aboutForm').on('submit.splash', function(e) { e.preventDefault(); $('#opaque, #aboutWindow').addClass('hidden'); });

  // Conditionally enable load/save buttons; show what Continue would load
  $('#saveRequest').prop('disabled', !Storage.canStore);
  var saved = null;
  try { saved = Storage.canStore ? Storage.getSavedGame() : null; } catch (err) { saved = null; }
  $('#splashLoad').prop('disabled', !saved);
  if (saved) {
    var meta = saved.alMeta || {};
    $('#continueName').text(meta.town || saved.name || 'Your town');
    $('#continueDate').text(meta.date ? ' \u00b7 ' + meta.date : '');
    $('#continueBox').removeClass('hidden');
    $('#splashFestus').removeClass('primary').addClass('secondary');
  }

  // Paint the minimap (the sandbox's map preview)
  this.splashCanvas = new SplashCanvas('splashContainer', tileSet);
  this.splashCanvas.paint(this.map);

  // Let's get some bits on screen!
  $('.awaitGeneration').toggle();
  // Aftersight: focus without scrolling the card on small screens
  var first = saved ? $('#splashLoad')[0] : $('#splashFestus')[0];
  if (first) first.focus({preventScroll: true});

  // Aftersight: ?play=festus (Play again, or a shared link) starts a new Festus game straight away
  if (/[?&]play=festus\b/.test(window.location.search)) {
    if (window.history && window.history.replaceState) window.history.replaceState(null, '', window.location.pathname);
    playFestus.call(this, {preventDefault: function() {}});
  }
}


// Generate a new map at the user's request, and paint it
var regenerateMap = function(e) {
  e.preventDefault();

  this.map = MapGenerator();
  this.splashCanvas.paint(this.map);
  sandboxThumbs.call(this);
};


var offAll = function() {
  $('#splashFestus, #splashSandbox, #splashLoad, #splashGenerate, #splashBack').off('click');
  $('#playForm').off('submit');
  $('#splashAbout').off('click.splash'); $('#aboutForm').off('submit.splash');
};


// Fetches game data from the storage manager, and launches the game. We won't return from here
var handleLoad = function(e) {
  e.preventDefault();

  var savedGame = Storage.getSavedGame();

  if (savedGame === null)
    return;

  // Remove installed event listeners
  offAll();

  // Hide the splashscreen UI
  $('#splash').hide();

  // Launch
  var g = new Game(savedGame, this.tileSet, this.snowTileSet, this.spriteSheet, Simulation.LEVEL_EASY, savedGame.name);
};


// Aftersight: Festus has its own map, name and tuning (easy), so it starts straight away
var playFestus = function(e) {
  e.preventDefault();
  offAll();
  $('#splash').hide();
  $('#alScenFestus').prop('checked', true);
  var g = new Game(this.map, this.tileSet, this.snowTileSet, this.spriteSheet, Simulation.LEVEL_EASY, 'Festus');
};


// The sandbox's town picker shows this map as the thumbnail for the starter town and the empty valley
var sandboxThumbs = function() {
  if (this.splashCanvas && this.splashCanvas._canvas) {
    var thumb = this.splashCanvas._canvas.toDataURL();
    $('#alStarterThumb, #alEmptyThumb').attr('src', thumb);
  }
};


// The sandbox: show the form asking for a map, a town name and a difficulty level
var acquireNameAndDifficulty = function(e) {
  e.preventDefault();

  $('#splash').hide();
  sandboxThumbs.call(this);
  if (!$('input[name=alScenario]:checked').val() || $('#alScenFestus').prop('checked')) $('#alStarter').prop('checked', true);

  // As a convenience, the city name is not mandatory in debug mode
  if (Config.debug)
    $('#nameForm').removeAttr('required');

  // Display the name and difficulty form
  $('#start').show();
  if ($('#nameForm')[0]) $('#nameForm')[0].focus({preventScroll: true});
};


var backToSplash = function(e) {
  e.preventDefault();
  $('#start').hide();
  $('#splash').show();
};


// This function should be called after the name/difficulty form has been submitted. The game will now be launched
// with the map selected earlier.
var play = function(e) {
  e.preventDefault();

  // As usual, uninstall event listeners, and hide the UI
  offAll();
  $('#start').hide();

  // What values did the player specify?
  var difficulty = $('.difficulty:checked').val() - 0;
  var name = $('#nameForm').val();

  // Launch a new game
  var g = new Game(this.map, this.tileSet, this.snowTileSet, this.spriteSheet, difficulty, name);
};


export { SplashScreen };
