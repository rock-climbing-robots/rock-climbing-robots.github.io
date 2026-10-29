// Hackathon on-boarding: what the competitors need on the first morning.
//
// Part 1: welcome and logistics (the website).
// Part 2: the challenge, rule by rule (rulebook v1.1, ~/rcr_rules).
// Part 3: recommended tools and leads.
//
// Each part is a scene of slides (lib/runner.js); a scene takes over the
// last slide of the one before it.

import { KIT_IMAGES } from "./lib/kit.js";
import { slideScene, splash } from "./lib/runner.js";
import { PART1_IMAGES, PRACTICAL_ICONS, titleSlide, teamsSlide, organisersSlide, venueSlide, scheduleSlide,
         practicalSlide } from "./lib/part1.js";
import { PART2_IMAGES, overviewSlide, challengesSlide, morphologySlide, powerSlide, providedSlide,
         wallSlide, levelsSlide, holdsSlide, mappingSlide, setupSlide, arucoSlide, perceptionSlide, simulationSlide,
         evaluationSlide, factorsSlide, timerSlide } from "./lib/part2.js";
import { PART3_IMAGES, CLOSING_ICONS, toolboxSlide, microbanSlide, onshapeSlide, pinocchioSlide, pinocchioCodeSlide, ikSlide, placoSlide,
         placoGallery, placoCodeSlide, sb3Slide, sb3CodeSlide, mjlabSlide, bamSlide, graphSlide,
         wbcSlide, closingSlide } from "./lib/part3.js";

export const title = "Hackathon on-boarding";
export const icons = [...new Set([...PRACTICAL_ICONS, ...CLOSING_ICONS])];
export const images = [...KIT_IMAGES, ...PART1_IMAGES, ...PART2_IMAGES, ...PART3_IMAGES];

const PART1 = [titleSlide, splash("1", "Welcome and logistics"), teamsSlide, organisersSlide, venueSlide,
               scheduleSlide, practicalSlide];
const PART2 = [splash("2", "The challenge", "Rules v1.1, step by step"), overviewSlide, challengesSlide,
               morphologySlide, powerSlide, providedSlide, wallSlide, levelsSlide, holdsSlide, mappingSlide, setupSlide,
               arucoSlide, perceptionSlide, simulationSlide, evaluationSlide, factorsSlide, timerSlide];
const PART3 = [splash("3", "Recommended tools and leads"), toolboxSlide, microbanSlide, onshapeSlide,
               pinocchioSlide, pinocchioCodeSlide, ikSlide, placoSlide, placoGallery, placoCodeSlide, sb3Slide, sb3CodeSlide,
               mjlabSlide, bamSlide, graphSlide, wbcSlide, closingSlide];

const last = (part) => part[part.length - 1];

const Logistics = slideScene("Welcome and logistics", PART1);
const Rules = slideScene("The challenge", PART2, { carry: last(PART1) });
const Tools = slideScene("Tools and leads", PART3, { carry: last(PART2) });

export const scenes = [Logistics, Rules, Tools];

export const figures = [];
