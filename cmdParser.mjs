import { readFile } from "fs/promises";

var commands = {};
var routines = []; //list of strings that are rotated every other moment
var routineIndex = 0;

/**
 * @description Looks through all commands within `./commands.json`. If there's anything specified within `remote`, get commands from there too & stack. (override local commands with remote ones.)
 */
async function loadCommands() {
  console.log("Fetching commands via the local config...");

  let reloadedCommands;

  try {
    reloadedCommands = JSON.parse(await readFile("./commands.json"));
  } catch (e) {
    console.error("Unable to read the commands file!", e);
    return;
  }

  commands = {};

  if (reloadedCommands.local)
    for (const cmd in reloadedCommands.local) {
      if (cmd == "_routines") {
        routineIndex = 0;
        routines = reloadedCommands.local[cmd];
      }
      commands[cmd] = reloadedCommands.local[cmd];
    }

  if (reloadedCommands.remote) {
    // Obtain the JSON from a remote resource, override the existing commands if applicable
    for (const link of reloadedCommands.remote) {
      console.log("Now loading remote commands from", link);

      const remoteCommands = JSON.parse(await (await fetch(link)).text());

      // Load these remote commands
      for (const cmd in remoteCommands) {
        commands[cmd] = remoteCommands[cmd];
      }
    }
  }
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

loadCommands();
