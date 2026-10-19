// ---------- conversations ----------
const L = (s, t, mood) => ({ s, t, mood });
const FX = fn => ({ fx: fn });
const CH = (...choices) => ({ choices });
function befriend(id, n) { H(id).rel = clamp(H(id).rel + n, 0, 100); }
function curAct(id) { return currentBlock(id).act; }
function seen(k) { return !!S.seen[k]; }
function see(k) { S.seen[k] = true; }

function afterMeet() {
  if (S.quest === 'meet' && RES_IDS.every(id => H(id).met)) {
    S.projects.solar.status = 'idea';
    setQuest('idea_solar');
    hooks.bolt("Power bills came up with all four of them. And Sunfield meadow gets sun all day. I have an idea, {name}. To the workbench!");
  }
}
function topOwner(pid) {
  const o = S.projects[pid].owners || {};
  let best = null, v = -1;
  for (const k in o) if (o[k] > v) { v = o[k]; best = k; }
  return best;
}

function talkTo(id) {
  const h = H(id);
  const steps = [];
  if (h.talkedDay !== S.day) { h.talkedDay = S.day; if (h.met) befriend(id, 3); }
  const fn = { mara: talkMara, teo: talkTeo, juno: talkJuno, odile: talkOdile }[id];
  steps.push(...fn(h));
  return steps;
}

// ---------------- Mara ----------------
function talkMara(h) {
  const act = curAct('mara');
  const n = NPCS.mara;
  if (!h.met) {
    const s = [];
    if (act === 'away' && n.moving) {
      s.push(L('mara', "Sorry, I can't stop. If I miss the 6:45 I lose the shift, and I can't lose a shift. Not with the power bill what it is.", 'rushed'));
      s.push(L('mara', "You're the one in the old garage? With the robot? I'm Mara. Come find me some evening. If I'm awake.", 'rushed'));
    } else {
      s.push(L('mara', "Oh. Hi. You're the one who moved into the old garage, with the robot. I'm Mara.", 'tired'));
      s.push(L('mara', 'Ten hours on my feet at the warehouse. Then I come home and the power bill is on the table, like it’s been waiting up for me.', 'tired'));
    }
    s.push(CH(
      { t: 'What do you do when you’re not working?', then: [L('mara', "Not working? (She laughs.) I used to bake. My grandmother's bread, with the cardamom. Now I'm too tired to even want to.", 'tired')] },
      { t: 'That sounds exhausting.', then: [L('mara', 'It is what it is. Pip needs shoes. Pip always needs shoes.', 'tired'), L('mara', 'Back when I had Sundays, I used to bake. Feels like somebody else’s life.', 'tired')] },
    ));
    s.push(FX(() => { h.met = true; h.knowPressure = true; h.knowInterest = true; befriend('mara', 6); logEvent('Met Mara. Long warehouse shifts; she used to bake.', 'person'); afterMeet(); }));
    return s;
  }
  if (S.quest === 'plan_solar' && !seen('mara_plan')) {
    return [L('mara', "Odile says you're calling a meeting about the sun thing. If it's ours, really ours, I'm in. I can't put in money. I can put in Saturday mornings.", 'neutral'), FX(() => see('mara_plan'))];
  }
  if (S.creations.kitchen.status === 'teased' && !seen('mara_kitchen')) {
    return [
      L('mara', 'I baked. Just one loaf. The whole street smelled of cardamom, and Teo knocked on my door like a lost dog.', 'happy'),
      L('mara', 'But my oven fits one loaf. One! If we had a real oven, a big one, we could feed everybody.', 'happy'),
      L('mara', "That terrace by Odile's store has been empty for years. A kitchen anyone could use. Breakfast for the whole street.", 'happy'),
      CH(
        { t: "Let's build it.", then: [L('mara', 'Really? Okay. I want a proper bread oven. Teo knows bricks. Juno will want to paint something. Odile has opinions about tables.', 'happy')] },
        { t: 'Only if I get the first slice.', then: [L('mara', 'Second slice. Pip gets the first. That’s non-negotiable.', 'happy')] },
      ),
      FX(() => { see('mara_kitchen'); S.creations.kitchen.status = 'available'; befriend('mara', 8); setQuest('kitchen'); logEvent("Mara proposed a shared kitchen on the old terrace.", 'idea'); }),
    ];
  }
  if (online('solar') && !seen('mara_solar')) {
    const o = S.projects.solar.option;
    const s = [];
    if (o === 'brightline') s.push(L('mara', 'Brightline sent a letter. A quarter off my power bill. That’s three dollars a day. I’ll take it. I’m still on the 6:45.', 'neutral'));
    else if (o === 'odile') s.push(L('mara', 'My power bill: two dollars. And a little deposit from the array. Odile’s is bigger, which, fair, it was her money. Still. Two dollars!', 'neutral'));
    else s.push(L('mara', 'My power bill came. Two dollars. I read it three times.', 'happy'), L('mara', 'And there was a deposit. From the array. Apparently I own part of the sun now.', 'happy'));
    s.push(FX(() => see('mara_solar')));
    return s;
  }
  if (online('workshop') && !seen('mara_workshop')) {
    return [
      L('mara', "A robot fixed Pip's bike in ten minutes and wouldn't take any money. I nearly cried in front of a robot.", 'happy'),
      L('mara', 'You know what would really help? Cargo bikes. Ones you can share. I could take Pip to school without the bus.', 'neutral'),
      FX(() => { see('mara_workshop'); S.flags.maraBikes = true; logEvent("Mara's idea: a shared cargo bike fleet.", 'idea'); }),
    ];
  }
  if (online('greenhouse') && !seen('mara_green')) {
    return [L('mara', 'Tomatoes. Real ones, that taste like something. Our food bill is half what it was. I keep doing the math in my head on the bus.', 'happy'), FX(() => see('mara_green'))];
  }
  if (h.stage === 'easing' && !seen('mara_easing')) {
    return [L('mara', 'I dropped my Sunday shift. Pip and I went down to the creek. He showed me a frog.', 'neutral'), L('mara', 'I’d forgotten he likes frogs.', 'neutral'), FX(() => see('mara_easing'))];
  }
  if ((S.quest === 'freedom' || questIndex() > questIndex('freedom')) && !seen('free_mara') && (h.stage === 'rest' || h.stage === 'thriving')) {
    if (h.stage === 'thriving') return [L('mara', 'I baked this morning. I didn’t plan to. I just woke up wanting to.', 'happy'), FX(() => { see('free_mara'); befriend('mara', 5); })];
    return [
      L('mara', 'No more shifts. I keep waking up at 5:40 with my heart pounding. Then I remember.', 'calm'),
      L('mara', 'Today I’m going to sit on this step and drink tea while it’s still hot. That’s the whole plan.', 'calm'),
      CH(
        { t: 'That’s a good plan.', then: [L('mara', 'Right? Nobody needs anything from me until Pip gets home.', 'happy')], fx: () => befriend('mara', 6) },
        { t: 'Have you thought about baking again?', then: [L('mara', 'Not yet. Ask me when I miss it. I think I will.', 'calm')], fx: () => { h.nudged = true; befriend('mara', 3); } },
        { t: 'Want to take a walk sometime?', then: [L('mara', 'Tomorrow. Today I’m a woman who sits.', 'happy')], fx: () => befriend('mara', 4) },
      ),
      FX(() => see('free_mara')),
    ];
  }
  if (S.creations.kitchen.status === 'built' && !S.flags.breakfastDone) {
    return [L('mara', 'Breakfast at the terrace, any morning you say. Everyone’s coming. I already told Odile to bring the good jam.', 'happy')];
  }
  return ambientMenu('mara');
}

// ---------------- Teo ----------------
function talkTeo(h) {
  const act = curAct('teo');
  const n = NPCS.teo;
  if (!h.met) {
    const s = [];
    if (act === 'away' && n.moving) {
      s.push(L('teo', 'Hm. New neighbor. Teo. Route starts at six, and the van won’t start itself. It barely starts at all.', 'rushed'));
    } else {
      s.push(L('teo', 'Hm. New neighbor. Teo.', 'tired'));
      s.push(L('teo', 'Don’t look at the garden. It used to be something. Rosa grew artichokes, the purple ones from Sicily. Now it’s weeds.', 'tired'));
    }
    s.push(L('teo', 'I drive twelve hours, I come home, I sleep. And the van eats half of what I make. Transmission, tires, inspections. A driver who can’t afford his own van. A joke, eh?', 'tired'));
    s.push(CH(
      { t: 'Who was Rosa?', then: [L('teo', 'My wife. Six years gone. She’d hate what I did to her garden.', 'tired')], fx: () => befriend('teo', 4) },
      { t: 'You know engines?', then: [L('teo', 'Forty years of fixing that van with my own hands. Engines, I know. Money, I don’t have.', 'neutral')] },
    ));
    s.push(FX(() => { h.met = true; h.knowPressure = true; h.knowInterest = true; befriend('teo', 5); logEvent("Met Teo. His van eats his wages; Rosa's garden has gone to weeds.", 'person'); afterMeet(); }));
    return s;
  }
  if (S.quest === 'van' && !seen('teo_van')) {
    return [
      L('teo', 'She’s done. The van. Transmission went on the hill road.', 'tired'),
      L('teo', 'The garage in the city wants eight hundred dollars, and my boss docks me for every day I’m not driving.', 'tired'),
      L('teo', 'But listen. You know what’s rusting in your garage? Three old service robots. Good motors. I looked through the window. Don’t make that face.', 'neutral'),
      L('teo', 'I could teach them. A repair shop that belongs to the street, not some company in the city. Fix my van, fix Pip’s bike, take orders from the whole valley.', 'neutral'),
      CH(
        { t: 'Let’s build it together.', then: [L('teo', 'Ha! Good. Draw it up on that bench of yours. I’ll tell you where you’re wrong.', 'happy')], fx: () => befriend('teo', 8) },
        { t: 'Can robots really learn repairs?', then: [L('teo', 'Better than my last three apprentices. They don’t argue. Much.', 'neutral')], fx: () => befriend('teo', 4) },
      ),
      FX(() => { see('teo_van'); S.projects.workshop.status = 'idea'; setQuest('idea_workshop'); logEvent("Teo's idea: a Robot Workshop in your garage.", 'idea'); hooks.bolt('Robot Workshop unlocked! I have always wanted colleagues.'); }),
    ];
  }
  if (S.quest === 'garden' && !seen('teo_garden')) {
    return [
      L('teo', 'Since the workshop, I get home before dark. I pulled weeds today. My back hates me.', 'neutral'),
      L('teo', 'That overgrown lot by my place? There are greenhouse frames under the brambles. Somebody had a plan, once.', 'neutral'),
      L('teo', 'With the robots watering at night, we could grow food for the whole street. And maybe I plant Rosa’s artichokes again.', 'happy'),
      CH(
        { t: 'Food is everyone’s second-biggest bill. Let’s do it.', then: [L('teo', 'Good. Pull the frames out of the brambles and draw it up.', 'happy')] },
        { t: 'Rosa would like that.', then: [L('teo', '(He looks away for a moment.) She would. She’d tell me I’m planting them too close.', 'calm')], fx: () => befriend('teo', 6) },
      ),
      FX(() => { see('teo_garden'); S.projects.greenhouse.status = 'idea'; setQuest('idea_greenhouse'); logEvent("Teo's idea: a greenhouse on the overgrown lot.", 'idea'); }),
    ];
  }
  if (online('solar') && !seen('teo_solar')) {
    const o = S.projects.solar.option;
    const t = o === 'brightline' ? 'Brightline. City people own our sunlight now. Hm. My power bill went down a little. A little.' : 'Huh. The sun pays my power bill now. Don’t tell the sun, it’ll want a raise.';
    return [L('teo', t, o === 'brightline' ? 'neutral' : 'happy'), FX(() => see('teo_solar'))];
  }
  if (online('workshop') && !seen('teo_ws')) {
    return [
      L('teo', 'The robots learn fast. Faster than apprentices, and they laugh at my jokes. Well. They beep.', 'happy'),
      L('teo', 'Orders come in from all over the valley. If we had a second bay, we could take twice as many.', 'neutral'),
      FX(() => { see('teo_ws'); S.flags.teoBay = true; }),
    ];
  }
  if (online('greenhouse') && !seen('teo_gh')) {
    return [L('teo', 'The robots water at night. I come in the morning and say good morning to the beans. Don’t laugh.', 'happy'), FX(() => see('teo_gh'))];
  }
  if ((S.quest === 'freedom' || questIndex() > questIndex('freedom')) && !seen('free_teo') && (h.stage === 'rest' || h.stage === 'thriving')) {
    if (h.stage === 'thriving') return [L('teo', h.focus === 'bikes' ? 'Fixed three bikes today. Pip races me. I lose on purpose. Mostly.' : 'First sprouts. Rosa’s artichokes. I talk to them. Don’t tell Odile.', 'happy'), FX(() => see('free_teo'))];
    return [
      L('teo', 'Forty years I drove. Today I woke at six and walked to the bus stop. Stood there like a fool.', 'neutral'),
      L('teo', 'Nobody needed me anywhere. I don’t know if I like it.', 'neutral'),
      CH(
        { t: 'You don’t have to know yet.', then: [L('teo', 'Hm. Maybe not.', 'calm')], fx: () => befriend('teo', 6) },
        { t: 'Rosa’s artichokes need you.', then: [L('teo', '...They do, don’t they. All right. Tomorrow I dig.', 'calm')], fx: () => { h.nudged = true; h.focus = 'garden'; befriend('teo', 4); } },
        { t: 'The robots could use a teacher. Bicycles, maybe?', then: [L('teo', 'Bicycles. Ha. There are six broken ones behind the depot. Tomorrow.', 'happy')], fx: () => { h.nudged = true; h.focus = 'bikes'; befriend('teo', 4); } },
      ),
      FX(() => see('free_teo')),
    ];
  }
  return ambientMenu('teo');
}

// ---------------- Juno ----------------
function talkJuno(h) {
  const act = curAct('juno');
  const n = NPCS.juno;
  if (!h.met) {
    const s = [];
    if (act === 'away' && n.moving) s.push(L('juno', 'Hi, sorry, I’m Juno, I’m late, I’m always late. Café at seven, then a night gig labeling pictures for an AI company.', 'rushed'));
    else s.push(L('juno', 'Hi. Sorry. I’m Juno. Café in the morning, and at night I label pictures for an AI company. “Is this a cat? Is this a cat?” Ten thousand times.', 'tired'));
    s.push(L('juno', 'Rent’s due on the first. Then it’s due again. Then again. Plus the student loan for a degree in illustration, which is funny if you think about it.', 'tired'));
    s.push(CH(
      { t: 'Is that a sketchbook?', then: [L('juno', 'Oh. Yeah. I carry it like a good-luck charm. I haven’t opened it in a year.', 'tired')], fx: () => befriend('juno', 5) },
      { t: 'Do you get any time off?', then: [L('juno', 'Sundays I sleep. Sometimes I dream about drawing, then wake up and label cats.', 'tired')] },
    ));
    s.push(FX(() => { h.met = true; h.knowPressure = true; h.knowInterest = true; befriend('juno', 5); logEvent('Met Juno. Two jobs and a student loan; a sketchbook she never opens.', 'person'); afterMeet(); }));
    return s;
  }
  if ((S.projects.solar.status === 'idea') && !S.flags.junoLeaf) {
    return [
      L('juno', 'You’re building something with the sun? {bot} told me. Well, {bot} told the whole bus stop.', 'neutral'),
      L('juno', 'Can I show you something? I drew it a year ago, on a napkin. (She holds up her phone: panels shaped like leaves, on curved stems.)', 'neutral'),
      L('juno', 'So it looks like it grew there instead of landing there.', 'neutral'),
      CH(
        { t: 'It’s beautiful. Can we build it?', then: [L('juno', 'Really? Okay. Okay! Don’t make it ugly.', 'happy')], fx: () => befriend('juno', 8) },
        { t: 'I’ll keep it in mind.', then: [L('juno', 'Sure. It’s on the napkin if you want it.', 'neutral')] },
      ),
      FX(() => { S.flags.junoLeaf = true; logEvent("Juno shared her leaf-canopy sketch. It's now a style option for the array.", 'idea'); }),
    ];
  }
  if (online('solar') && !seen('juno_solar')) {
    const p = S.projects.solar;
    let t = 'The array is actually kind of beautiful? Don’t tell anyone I said that.';
    if (p.style === 'leaf') t = 'They built my leaves. I walk past them on purpose. Twice a day.';
    if (p.option === 'brightline') t = 'Brightline put their logo on it. Big blue letters. Very corporate sunflower.';
    return [L('juno', t, p.option === 'brightline' ? 'neutral' : 'happy'), FX(() => see('juno_solar'))];
  }
  if (h.stage === 'easing' && !seen('juno_easing')) {
    return [L('juno', 'I quit the night gig. Turns out I don’t miss the cats. “Is this a cat?” Not my problem anymore.', 'happy'), FX(() => see('juno_easing'))];
  }
  if (online('greenhouse') && !seen('juno_gh')) {
    return [
      L('juno', 'I saw a video about fish that fertilize lettuce. Fish-poop salad. I’m serious, it’s a whole thing. Aquaponics.', 'neutral'),
      L('juno', 'The greenhouse could have tanks. More food, and you get to name the fish.', 'happy'),
      FX(() => { see('juno_gh'); S.flags.junoAqua = true; }),
    ];
  }
  if (online('workshop') && !seen('juno_ws')) {
    return [L('juno', 'There’s a robot in Teo’s workshop that hums while it solders. I’m going to draw it someday. Someday.', 'neutral'), FX(() => see('juno_ws'))];
  }
  if ((S.quest === 'freedom' || questIndex() > questIndex('freedom')) && !seen('free_juno') && (h.stage === 'rest' || h.stage === 'thriving')) {
    if (h.stage === 'thriving') return [L('juno', 'I filled eleven pages. Bad ones, mostly. It’s the best I’ve felt in years.', 'happy'), FX(() => see('free_juno'))];
    return [
      L('juno', 'So I’m free. Technically. I keep opening the sketchbook and closing it again.', 'calm'),
      L('juno', 'What if I’m not good anymore? What if I was only good because I never had time to find out I wasn’t?', 'neutral'),
      CH(
        { t: 'No one’s grading it.', then: [L('juno', '...Huh. Nobody is, are they.', 'calm')], fx: () => { h.nudged = true; befriend('juno', 5); } },
        { t: 'The waterfall is lovely in the morning.', then: [L('juno', 'Is it? Maybe I’ll go look. Just look.', 'calm')], fx: () => { h.nudged = true; befriend('juno', 5); } },
        { t: 'Rest first. It’ll keep.', then: [L('juno', 'Yeah. Okay. I can do that. I’m good at sleeping, at least.', 'calm')], fx: () => befriend('juno', 6) },
      ),
      FX(() => see('free_juno')),
    ];
  }
  return ambientMenu('juno');
}

// ---------------- Odile ----------------
function talkOdile(h) {
  if (!h.met) {
    return [
      L('odile', 'Welcome to Brandt’s. We have milk, bread from the city, and opinions. The opinions are free.', 'tired'),
      L('odile', 'The freezers cost more to run than my house. Prices go up, people buy less, so I stay open longer. Twelve hours a day. My knees have filed a complaint.', 'tired'),
      CH(
        { t: 'Why not close earlier?', then: [L('odile', 'And live on what? I have some savings, for when I’m old. According to my knees, that’s now.', 'tired')] },
        { t: 'What did you love, before the store?', then: [L('odile', 'Before? (She snorts.) My father played the accordion. Taught me three songs. I haven’t played in twenty years.', 'neutral')], fx: () => befriend('odile', 4) },
      ),
      L('odile', 'If you build something that earns money, come talk to me. My savings aren’t a charity. But they’re not doing much in the bank, either.', 'neutral'),
      FX(() => { h.met = true; h.knowPressure = true; h.knowInterest = true; befriend('odile', 5); logEvent('Met Odile. Freezer bills keep her store open twelve hours; she has savings.', 'person'); afterMeet(); }),
    ];
  }
  if (odileShareReady()) {
    return [
      L('odile', 'I counted it twice. My shares pay me more than the store ever did. More than I need.', 'calm'),
      L('odile', 'And Juno still runs for the bus every morning. Mara too. I see them through the window.', 'neutral'),
      CH(
        { t: 'Would you share some of your stake with them?', then: [L('odile', 'Half. Put half of mine in their names, the ones who still need it. And don’t make a speech about it.', 'calm')], fx: () => { doOdileShare(); befriend('odile', 10); hooks.changed(); } },
        { t: 'It was your money. You earned it.', then: [L('odile', 'I did. And I’m not sure what I earned it for, if not this. Half. Put half in their names.', 'calm')], fx: () => { doOdileShare(); befriend('odile', 6); hooks.changed(); } },
      ),
    ];
  }
  if (online('solar') && !seen('odile_solar')) {
    const o = S.projects.solar.option;
    const s = [];
    if (o === 'odile') s.push(L('odile', 'The array paid me more yesterday than the store did. I don’t know how to feel about that. Mostly good.', 'happy'));
    else if (o === 'brightline') s.push(L('odile', 'Brightline knocked a quarter off my freezer bill. Better than nothing. Not much better.', 'neutral'));
    else s.push(L('odile', 'My freezer bill. Gone. I danced. Behind the counter, where nobody could see.', 'happy'));
    s.push(L('odile', 'You know power is dearest at six in the evening? If the array could hold its sun until then, it would sell for twice as much.', 'neutral'));
    s.push(FX(() => { see('odile_solar'); S.flags.odileBattery = true; logEvent("Odile's idea: a battery bank to sell power in the evening.", 'idea'); }));
    return s;
  }
  if ((S.quest === 'freedom' || questIndex() > questIndex('freedom')) && !seen('free_odile') && (h.stage === 'rest' || h.stage === 'thriving')) {
    return [
      L('odile', 'I close at noon now. Then I sit out front and watch people. Turns out people are better than television.', 'happy'),
      L('odile', 'And I found my father’s accordion in the attic. It wheezes. So do I. We’ll get along.', 'happy'),
      CH(
        { t: 'Play for us sometime?', then: [L('odile', 'Come to the plaza at dusk, if you want to suffer.', 'happy')], fx: () => { h.nudged = true; befriend('odile', 5); } },
        { t: 'You deserve the rest.', then: [L('odile', 'Everybody does. That’s rather the point, isn’t it?', 'calm')], fx: () => befriend('odile', 5) },
      ),
      FX(() => see('free_odile')),
    ];
  }
  return ambientMenu('odile');
}

// ---------------- the everyday conversation menu ----------------
function ambientMenu(id) {
  return [L(id, ambientLine(id), npcMood(id, currentBlock(id), false)), menuStep(id)];
}
function menuStep(id) {
  return CH(
    { t: 'How are you holding up?', then: [L(id, statusLine(id), npcMood(id, currentBlock(id), false))], again: true },
    { t: 'What would you do with a free day?', then: [L(id, interestLine(id), 'neutral')], fx: () => { H(id).knowInterest = true; }, again: true },
    { t: 'What do you make of the projects?', then: [L(id, projectsLine(id), 'neutral')], again: true },
    { t: 'See you around.', then: [] },
  );
}

function ambientLine(id) {
  const h = H(id), b = currentBlock(id);
  const m = S.minute % 1440;
  if (b.act === 'breakfast') return { mara: 'Eat! There’s more in the oven.', teo: 'This bread. Mara, marry me. I’m joking. Mostly.', juno: 'I’m drawing everyone’s plates. Don’t eat yet. Okay, eat.', odile: 'The good jam. I said I’d bring it and I brought it.' }[id];
  if (b.act === 'accordion') return 'Song number two of three. Requests are not accepted.';
  if (b.act === 'sketch') return 'I’m trying to get the light right. It keeps moving. Rude of it.';
  if (b.act === 'paint') return 'The mural is everybody on the street. You’re in it. Don’t look yet.';
  if (b.act === 'bake') return 'Fresh loaf in twenty minutes. Stay close.';
  if (b.act === 'garden' && h.stage === 'thriving') return 'Look at that soil. Black as coffee.';
  if (b.act === 'bikes') return 'This one was rusted solid. Look at it now.';
  if (b.act === 'store') return h.stage === 'overworked' ? 'Back again? I’m here till seven. As always.' : 'Morning! I’m closing at noon, so buy your milk like you mean it.';
  if (b.act === 'social') return 'Join us. Teo is telling the story about the goat again.';
  if (b.act === 'busstop') return 'Old habits. I come here and watch the bus leave without me. It’s nice, actually.';
  if (b.act === 'door') return h.energy < 36 ? 'Oh. It’s you. Come in? No, I’m kidding, I’m too tired for guests. What is it?' : 'Hey! Come to visit?';
  if (b.act === 'away' && NPCS[id].moving) return { mara: 'Walk with me, I can’t stop.', teo: 'Talk while I walk.', juno: 'I have like ninety seconds.', odile: 'Quickly, please.' }[id];
  if (h.stage === 'overworked') return h.energy < 36 ? { mara: 'Mm. Hi. Sorry. I’m running on fumes.', teo: 'Hm.', juno: 'Hi. I’m awake. Mostly.', odile: 'What can I get you? Besides a nap for me.' }[id] : 'Hi, ' + S.player.name + '.';
  if (h.stage === 'easing') return { mara: 'Hey, you! I had lunch sitting down today.', teo: 'Back before dark again. Strange feeling.', juno: 'Hi! I slept eight hours. Is this what people feel like?', odile: 'You look well. I look well too, apparently. Customers keep saying so.' }[id];
  if (m < 9 * 60) return 'Morning, ' + S.player.name + '.';
  return { mara: 'Hi, neighbor.', teo: 'Ciao.', juno: 'Oh, hey!', odile: 'Hello, dear.' }[id];
}

function statusLine(id) {
  const h = H(id), w = h.work;
  const W = fmtHours(w);
  const L2 = {
    mara: w >= 8 ? `${W} a day at the warehouse, plus the bus. Pip thinks I live there.` : w >= 4 ? `Down to ${W} a day. I saw a sunset last week. A real one, not on my phone.` : w > 0 ? `Just ${W} a day now. I pick Pip up from school. He’s embarrassed. I love it.` : 'No shifts. I’m still learning what to do with my hands. Turns out: dough.',
    teo: w >= 8 ? `${W} a day behind the wheel. My spine is shaped like the seat.` : w >= 4 ? `${W} a day. I’m home before dark. The weeds are nervous.` : w > 0 ? `A few hours. ${W}. The van’s gone, the workshop fixes what I used to pay for.` : 'Retired, I suppose. From driving, anyway. Not from living.',
    juno: w >= 8 ? `Café plus the night gig: ${W} a day. I sleep on the bus. Professionally.` : w >= 4 ? `${W} a day. Just the café now. I can feel my face again.` : w > 0 ? `${W} a day. I’m almost a person.` : 'No job I need to keep. I keep checking that it’s true.',
    odile: w >= 8 ? `Store’s open ${W} a day. Same as always. The freezers hum, I hum back.` : w >= 4 ? `${W} a day now. I close before dinner. I eat dinner! Sitting down!` : w > 0 ? `${W} a day. The store’s a hobby with a cash register.` : 'I open because I like the company. The money comes from the array and the workshop.',
  };
  let s = L2[id];
  if (h.energy < 30) s += ' I’m so tired.';
  else if (h.energy > 75) s += ' And I feel good. Actually good.';
  return s;
}
function interestLine(id) {
  const h = H(id);
  if (h.stage === 'thriving') return { mara: 'Bake. Then bake more. Then make Teo carry it to everybody.', teo: 'What I’m doing now. Dirt, bikes, and a nap at two.', juno: 'Draw. I’m doing it. Every day.', odile: 'Play badly at dusk and enjoy it enormously.' }[id];
  return { mara: 'Bake. My grandmother’s bread. Cardamom and a little orange zest. It made the whole house warm.', teo: 'Dig. Bring back Rosa’s artichokes. Maybe fix some old bicycles for the kids.', juno: 'Sit by the waterfall and draw until my hand hurts. A good hurt.', odile: 'Play my father’s accordion in the plaza and let people complain.' }[id];
}
function projectsLine(id) {
  const anyOnline = Object.keys(PROJECTS).some(online);
  if (!anyOnline) return { mara: 'I’ll believe it when my bills believe it.', teo: 'Show me something that runs and I’ll have an opinion.', juno: 'I like that someone’s trying. That’s new.', odile: 'Projects cost money. Who pays, who owns, who gets paid. Get that right and I’m listening.' }[id];
  const inc = incomeOf(id).total;
  const owners = {};
  for (const pid in PROJECTS) if (online(pid)) { const o = S.projects[pid].owners || {}; for (const k in o) owners[k] = (owners[k] || 0) + o[k]; }
  let top = null, tv = 0; for (const k in owners) if (owners[k] > tv) { tv = owners[k]; top = k; }
  const concentrated = top && top !== id && top !== 'commons' && tv > (owners[id] || 0) * 2.2;
  if (concentrated) {
    const who = OWNER_NAMES[top];
    return { mara: `The bills are better. But most of the money goes to ${who}. Good for them. I’m still on the bus.`, teo: `${who} gets the big share. I get the small one. The math is not hard.`, juno: `I mean, ${who} put in the money. But I still run for the bus, so.`, odile: `Most of it comes to me, which my bank likes. My neighbors are still tired, which I don’t.` }[id];
  }
  return { mara: `There’s a little deposit every morning. ${fmtMoney(inc)} a day. It’s not a lottery ticket. It’s better. It comes back tomorrow.`, teo: `${fmtMoney(inc)} a day from things we built. My father would’ve called it communism. My mother would’ve called it sense.`, juno: `${fmtMoney(inc)} a day that I don’t have to label cats for. I own a piece of a robot. That sentence is wild.`, odile: `${fmtMoney(inc)} a day, and it doesn’t need me behind a counter. The commons share pays for the next thing. That part I like most.` }[id];
}

// ---------------- your robot ----------------
function talkBolt() {
  const obj = objectives()[0];
  const flavor = [
    'My diagnostics say the town is ' + Math.round(S.warmth * 100) + '% cozy. That number used to be lower.',
    'I counted the birds. There are more of them than last week.',
    'You can press Next morning whenever you like. The town keeps running while we sleep.',
    'Parts are for building. Money in the Commons Fund can cover missing parts at $4 each.',
    'The Ledger shows where every dollar comes from and who it goes to. I find it relaxing.',
  ];
  return [
    L('bolt', obj ? `Our next step: ${obj.text}. ${obj.detail}` : 'Nothing urgent. Shall we go for a walk?', 'happy'),
    L('bolt', pick(flavor), 'happy'),
  ];
}
