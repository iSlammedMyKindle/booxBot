import { readFile, access, writeFile } from "fs/promises";
import { authenticateTwitch } from "kindle-twitch-oauth";
import { RefreshingAuthProvider, getTokenInfo } from "@twurple/auth";
import { ClearMsg, ChatMessage, ChatClient } from "@twurple/chat";
import { parseMessage, loadCommands, hydrateRoutines } from "./cmdParser.mjs";
// import { ApiClient } from '@twurple/api';

// Open up config.json
// Intentionally break if it's not there, it's a requirement to run the app.
let configFile = JSON.parse(await readFile("./config.json"));

let tokensFile;
try {
  await access("./tokens.json");
  tokensFile = JSON.parse(await readFile("./tokens.json"));
  console.log("Using saved token data found in ./tokens.json");
} catch (e) {
  // Obtain configuration from main config.json
  tokensFile = await authenticateTwitch(
    configFile.twitch,
    configFile.webServer
  );

  await writeFile("./tokens.json", JSON.stringify(tokensFile));
  console.log("Saved token data.");
}

// If bad data is given to our auth provider you'll get a log along the lines of "no valid token avaiable; trying to refresh.." etc.
const authProvider = new RefreshingAuthProvider({
  clientId: configFile.twitch.client_id,
  clientSecret: configFile.twitch.client_secret,
});

authProvider.onRefresh(async function (_userId, newTokenData) {
  // console.warn('yes', _userId, newTokenData);
  tokensFile = newTokenData;

  return await writeFile(
    "./tokens.json",
    JSON.stringify(newTokenData, null, 4),
    "utf-8"
  );
});

// Add the bot via it's ID / username in order to send & receive stuff
authProvider.addUser(configFile.twitch.bot_user, tokensFile, ["chat"]);

const chatClient = new ChatClient({
  authProvider,
  channels: configFile.twitch.channels,
});
chatClient.connect();
chatClient.onMessage(function (channel, user, text, msg) {
  console.log("yay", channel, user, text);
  // chatClient.say(configFile.twitch.channels[0], "test", { replyTo: msg.id });

  if (text[0] == "!") parseMessage(chatClient, ...arguments);

  // re-hydrate routines
  hydrateRoutines(chatClient, channel);
});

loadCommands();