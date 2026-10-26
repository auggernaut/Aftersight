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

import { BuildingTool } from './buildingTool.js';
import { BulldozerTool } from './bulldozerTool.js';
import { EventEmitter } from './eventEmitter.js';
import { QUERY_WINDOW_NEEDED } from './messages.ts';
import { MiscUtils } from './miscUtils.js';
import { ParkTool } from './parkTool.js';
import { RailTool } from './railTool.js';
import { RoadTool } from './roadTool.js';
import { QueryTool } from './queryTool.js';
import * as TileValues from "./tileValues.ts";
import { WireTool } from './wireTool.js';
import * as AL from './afterlight/buildings.js';

function GameTools(map) {
  var tools = EventEmitter({
    airport: new BuildingTool(10000, TileValues.AIRPORT, map, 6, false),
    bulldozer: new BulldozerTool(map),
    coal: new BuildingTool(3000, TileValues.POWERPLANT, map, 4, false),
    commercial: new BuildingTool(100, TileValues.COMCLR, map, 3, false),
    fire: new BuildingTool(500, TileValues.FIRESTATION, map, 3, false),
    industrial: new BuildingTool(100, TileValues.INDCLR, map, 3, false),
    nuclear: new BuildingTool(5000, TileValues.NUCLEAR, map, 4, true),
    park: new ParkTool(map),
    police: new BuildingTool(500, TileValues.POLICESTATION, map, 3, false),
    port: new BuildingTool(3000, TileValues.PORT, map, 4, false),
    rail: new RailTool(map),
    residential: new BuildingTool(100, TileValues.FREEZ, map, 3, false),
    road: new RoadTool(map),
    query: new QueryTool(map),
    stadium: new BuildingTool(5000, TileValues.STADIUM, map, 4, false),
    wire: new WireTool(map),
    // Afterlight buildings (see afterlight/buildings.js)
    dcHelix: new BuildingTool(100, AL.DC_HELIX, map, 3, false),
    dcCoop: new BuildingTool(4000, AL.DC_COOP, map, 3, false),
    solar: new BuildingTool(1500, AL.SOLAR, map, 3, false),
    solarCheap: new BuildingTool(750, AL.SOLAR, map, 3, false),
    depotHelix: new BuildingTool(100, AL.DEPOT_HELIX, map, 3, false),
    depotCoop: new BuildingTool(2500, AL.DEPOT_COOP, map, 3, false),
    fusion: new BuildingTool(8000, AL.FUSION, map, 3, false),
    clinic: new BuildingTool(1200, AL.CLINIC, map, 3, false),
  });

  tools.query.addEventListener(QUERY_WINDOW_NEEDED, MiscUtils.reflectEvent.bind(tools, QUERY_WINDOW_NEEDED));

  return tools;
}


export { GameTools };
