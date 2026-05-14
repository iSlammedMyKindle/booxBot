import { describe, it, expect } from "@jest/globals";
import { isSpamMessage } from "../spamDeletion.mjs";

describe("Spam Detection", () => {
  it("should detect exact scam phrases", () => {
    expect(
      isSpamMessage(
        "Wanna become famous? Buy followers, primes and views on"
      )
    ).toBe(true);
    expect(isSpamMessage("Boost your channel with real viewers")).toBe(true);
    expect(isSpamMessage("best viewsat")).toBe(true);
    expect(
      isSpamMessage(
        "Hello, sorry for bothering you. I want to offer promotion of your channel"
      )
    ).toBe(true);
    expect(
      isSpamMessage("Buy followers, primes, and viewers at")
    ).toBe(true);
    expect(isSpamMessage("Get free Twitch followers at")).toBe(true);
    expect(isSpamMessage("Visit this Twitch stream for a")).toBe(true);
    expect(isSpamMessage("Wanna grow? Get viewers and followers at")).toBe(
      true
    );
    expect(isSpamMessage("Free viewers for your stream")).toBe(true);
    expect(
      isSpamMessage("Offering logo/overlay design for your channel DM me")
    ).toBe(true);
  });

  it("should detect domain + pattern combinations", () => {
    expect(
      isSpamMessage("Buy followers and visit streamskill.net today!")
    ).toBe(true);
    expect(
      isSpamMessage("Get free viewers at streamrise dot com")
    ).toBe(true);
    expect(isSpamMessage("dogehype has buy followers")).toBe(true);
    expect(
      isSpamMessage("wbluechekdsa.com - wanna become famous?")
    ).toBe(true);
  });

  it("should NOT flag domain-only messages", () => {
    expect(isSpamMessage("Check out dogehype.com for amazing deals!")).toBe(
      false
    );
    expect(isSpamMessage("Visit wbluechekdsa.com now!")).toBe(false);
    expect(isSpamMessage("Check out this stream-rise promotion")).toBe(false);
    expect(isSpamMessage("bigfollows is a site")).toBe(false);
    expect(isSpamMessage("twitchplay and twitchgaming are cool")).toBe(false);
  });

  it("should NOT flag pattern-only messages", () => {
    expect(isSpamMessage("Want to buy followers for your stream?")).toBe(
      false
    );
    expect(isSpamMessage("Get free viewers today!")).toBe(false);
    expect(isSpamMessage("I wanna become famous someday")).toBe(false);
    expect(isSpamMessage("How can I get followers?")).toBe(false);
  });

  it("should NOT flag normal messages", () => {
    expect(isSpamMessage("Hello everyone, how's your stream going?")).toBe(
      false
    );
    expect(isSpamMessage("I love playing games on twitch.tv")).toBe(false);
    expect(isSpamMessage("Great gameplay today!")).toBe(false);
    expect(isSpamMessage("Follow me on social media")).toBe(false);
  });

  it("should handle edge cases", () => {
    expect(isSpamMessage("")).toBe(false);
    expect(isSpamMessage()).toBe(false);
    expect(isSpamMessage(null)).toBe(false);
    expect(isSpamMessage(undefined)).toBe(false);
  });
});
