import { readFile } from "fs/promises";

// These are special commands that are functions instead of JSON. They can't be distributed like the JSON ones can, so it should be secure to just add these on
var commands = {};
var routines = []; //list of strings that are rotated every other moment
var routineInterval;
var routineStoppingPoint;
var routineIndex = 0;

const specialCommands = {
  reload: {
    out: (channel = "", sender = "", text = "", mentions) => {
      if (channel != sender) return;
      loadCommands();
      return "Commands are reloading!";
    },
  },
  help: {
    out:()=>Object.keys(commands).map((key)=>key == 'reload' ? undefined : '!' + key + ' - ' + commands[key].desc).filter(e=>e).join(' | '),
    desc: 'Sends out this message!'
  }
};

/**
 * @description Looks through all commands within `./commands.json`. If there's anything specified within `remote`, get commands from there too & stack. (override local commands with remote ones.)
 */
export async function loadCommands() {
  console.log("Fetching commands via the local config...");

  let reloadedCommands = [];
  commands = { ...specialCommands };
  
  try {
    const rootFile = JSON.parse(await readFile("./commands.json"));
    reloadedCommands.push(rootFile);

    // Search for other files to load
    if(rootFile.files){
      // This can only happen in the root file, putting it into a non-main file won't do anything
      for(const file of rootFile.files) reloadedCommands.push(JSON.parse(await readFile(file)));
    }

  } catch (e) {
    console.error("Unable to read the commands file!", e);
    return;
  }


  for(const commandFile of reloadedCommands){
    if (commandFile.local)
      for (const cmd in commandFile.local) {
        if (cmd == "_routines") {
          routineIndex = 0;
          routines = commandFile.local[cmd];
        }
        else commands[cmd] = commandFile.local[cmd];
      }
  
    if (commandFile.remote) {
      // Obtain the JSON from a remote resource, override the existing commands if applicable
      for (const link of commandFile.remote) {
        console.log("Now loading remote commands from", link);
  
        const remoteCommands = JSON.parse(await (await fetch(link)).text());
  
        // Load these remote commands
        for (const cmd in remoteCommands) {
          commands[cmd] = remoteCommands[cmd];
        }
      }
    }
  }

  // Start the routines, restart the index
  routineIndex = 0;
  clearInterval(routineInterval);
}

/**
 * Re-does the timer for the intervals, keeps them going for about 30 minutes, then stops.
 * It will refresh when another person speaks
 * @param {*} client 
 * @param {*} channel 
 */
export function hydrateRoutines(client, channel){
  clearTimeout(routineStoppingPoint);
  routineStoppingPoint = setTimeout(()=>{
    clearInterval(routineInterval)
    routineInterval = undefined;
  }, 1000 * 60 * 31); // 31 minutes, approximate because a message is sent every 15 minutes

  if(!routineInterval) routineInterval = setInterval(()=>{
    if(routineIndex > routines.length -1) routineIndex = 0

    client.say(channel, routines[routineIndex]);

    routineIndex ++;
  }, 1000 * 60 * 15)
}

/**
 * Convert the message into a command that functions
 * @param {ChatClient} client the client that received the message, in order to send something back
 * @param {String} channel what twitch channel did this come from?
 * @param {String} user who sent the message?
 * @param {String} text message body
 * @param {ChatMessage} msg more metadata about the message itself, includes the `id` necessary to reply
 */
export function parseMessage(client, channel, user, text, msg) {
  const parsedContent = text.substring(1).split(" ");

  // First check the pre-loaded list of commands
  if (commands[parsedContent[0]]) {
    let resultOutput = commands[parsedContent[0]].out;
    let users = [];
    let invalidUsr = false;
    let highestUsr = 0;

    // Given the result output, replace elements from keywords such as %rng with output representing desired string concatinations

    // Obtain user information, if there's not enough users to parse upcoming input, issue an error
    for (const str of parsedContent) {
      if (str.indexOf("@") > -1)
        users.push(
          ...str
            .split("@")
            .filter((e) => e)
            .map((str) => {
              return str.split(" ")[0];
            })
        );
    }

    if (typeof resultOutput == "function") {
      const out = resultOutput(channel, user, text, users);

      if (out)
        client.say(channel, out, {
          replyTo: msg.id,
        });

      return;
    }

    // usr
    if (resultOutput.indexOf("%usr") > -1) {
      // Split the string up, get the indexes of each desired user & replace the index with the desired user
      resultOutput = resultOutput
        .split("%usr")
        .map((str) => {
          const targetIndex = str.substring(0, str.search(/[^0-9]/));

          if (targetIndex * 1 + 1 > highestUsr)
            highestUsr = targetIndex * 1 + 1;

          if (targetIndex !== "" && !users[targetIndex]) invalidUsr = true;

          const usrStr = targetIndex === "" ? "" : "@" + users[targetIndex];

          return usrStr + str.substring(targetIndex.length);
        })
        .join("");
    }

    if (invalidUsr)
      resultOutput =
        "This command requires " +
        highestUsr +
        " user(s) to be mentioned. Be sure to @ them! (e.g @userxyz123)";

    // sender
    if (resultOutput.indexOf("%sender") > -1)
      resultOutput = resultOutput.replaceAll("%sender", "@" + user);

    // rng
    while (resultOutput.indexOf("%rng") > -1)
      resultOutput = resultOutput.replace(
        "%rng",
        commands[parsedContent[0]].rng[
          Math.floor(Math.random() * commands[parsedContent[0]].rng.length)
        ]
      );

    // Grab the command's output and spew it
    client.say(channel, resultOutput, { replyTo: msg.id });
  }

  // If a command doesn't exist above, check the special commands list and execute a function

  // Otherwise don't do anything; printing an error here wouldn't make sense since a channel could have plenty of other bots.
}