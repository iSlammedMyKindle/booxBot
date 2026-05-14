import { readFile, access, writeFile } from "fs/promises";
import { authenticateTwitch } from "kindle-twitch-oauth";
import { RefreshingAuthProvider, getTokenInfo } from "@twurple/auth";
import { ClearMsg, ChatMessage, ChatClient } from "@twurple/chat";
import { ApiClient } from "@twurple/api";
import { parseMessage, loadCommands, hydrateRoutines } from "./cmdParser.mjs";
import { isSpamMessage } from "./spamDeletion.mjs";

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
    configFile.webServer,
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
    "utf-8",
  );
});

// Add the bot via it's ID / username in order to send & receive stuff
// authProvider.addUser(configFile.twitch.bot_user, tokensFile, ["chat"]);
const botUserId = (await getTokenInfo(tokensFile.accessToken, configFile.twitch.client_id)).userId

const chatClient = new ChatClient({
  authProvider,
  channels: configFile.twitch.channels,
});
chatClient.connect();

// This is for deleting messages
const apiClient = new ApiClient({ authProvider });
authProvider.addUser(botUserId, tokensFile, ["chat", "moderator"]);

chatClient.onMessage(async function (channel, user, text, msg) {
  console.log("message", channel, user, text);

  // Check for spam and delete if detected
  if (isSpamMessage(text)) {
    // It doesn't matter if the broadcaster sends something; perms don't allow for it, which make it impossible to delete
    if (channel == user) return;

    // Other users though... they're in for a ride
    try {
      apiClient.asUser(botUserId,
        async ctx => {
          ctx.moderation.deleteChatMessages(msg.channelId, msg.id)
        }
      );
      console.log(`Deleted spam message from ${user} in ${channel}: "${text}"`);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }

    // Stop processing this message further
    return;
  }

  if (text[0] == "!") parseMessage(chatClient, ...arguments);

  // re-hydrate routines
  hydrateRoutines(chatClient, channel);
});

loadCommands();
