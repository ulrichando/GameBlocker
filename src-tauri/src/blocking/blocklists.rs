//! Default blocklists for games, AI services, and gaming websites.

use std::collections::HashSet;

/// Get default list of gaming process names to block
pub fn get_default_gaming_processes() -> HashSet<String> {
    let processes = [
        // Steam
        "steam",
        "steam.exe",
        "steamwebhelper",
        "steamwebhelper.exe",
        "steamservice.exe",
        "Steam.app",
        // Epic Games
        "epicgameslauncher",
        "epicgameslauncher.exe",
        "EpicWebHelper.exe",
        "Epic Games Launcher.app",
        // EA/Origin
        "origin",
        "origin.exe",
        "OriginWebHelperService.exe",
        "EADesktop.exe",
        "EABackgroundService.exe",
        // Battle.net
        "battle.net",
        "battle.net.exe",
        "agent.exe",
        "Battle.net.app",
        // Ubisoft
        "ubisoftconnect",
        "ubisoftconnect.exe",
        "upc.exe",
        "UplayWebCore.exe",
        "Ubisoft Connect.app",
        // GOG
        "galaxyclient",
        "galaxyclient.exe",
        "GOG Galaxy.app",
        // Discord (for gaming communities)
        "discord",
        "discord.exe",
        "Discord.app",
        // Roblox
        "robloxplayerbeta",
        "robloxplayerbeta.exe",
        "RobloxPlayerBeta.app",
        "robloxstudiobeta.exe",
        // Minecraft
        "minecraft",
        "javaw.exe", // Minecraft Java
        "minecraft-launcher",
        "Minecraft.app",
        // League of Legends
        "leagueclient",
        "leagueclient.exe",
        "league of legends.exe",
        // Fortnite
        "fortniteclient-win64-shipping.exe",
        "fortnitelauncher.exe",
        // Valorant
        "valorant.exe",
        "valorant-win64-shipping.exe",
        "vanguard.exe",
        // CS2/CSGO
        "cs2.exe",
        "csgo.exe",
        // Overwatch
        "overwatch.exe",
        // Genshin Impact
        "genshinimpact.exe",
        "yuanshen.exe",
        // Other launchers
        "playnite.exe",
        "playnite.desktopapp.exe",
        // Linux gaming
        "lutris",
        "gamescope",
        "wine",
        "wine64",
        "proton",
        // Streaming services with games
        "geforcenow.exe",
        "xboxapp.exe",
        "gamingservices.exe",
    ];

    processes.iter().map(|s| s.to_lowercase()).collect()
}

/// Get default list of browser process names to block
pub fn get_default_browser_processes() -> HashSet<String> {
    let processes = [
        // Google Chrome
        "chrome",
        "chrome.exe",
        "Google Chrome.app",
        "google-chrome",
        "google-chrome-stable",
        // Chromium
        "chromium",
        "chromium.exe",
        "chromium-browser",
        "Chromium.app",
        // Firefox
        "firefox",
        "firefox.exe",
        "Firefox.app",
        "firefox-esr",
        // Microsoft Edge
        "msedge",
        "msedge.exe",
        "Microsoft Edge.app",
        // Brave
        "brave",
        "brave.exe",
        "Brave Browser.app",
        "brave-browser",
        // Opera
        "opera",
        "opera.exe",
        "Opera.app",
        // Opera GX
        "opera_gx",
        "opera_gx.exe",
        // Vivaldi
        "vivaldi",
        "vivaldi.exe",
        "Vivaldi.app",
        // Safari (macOS)
        "Safari.app",
        "safari",
        // Arc
        "arc",
        "Arc.app",
        // Tor Browser
        "tor",
        "tor.exe",
        "Tor Browser.app",
        // Internet Explorer / Edge Legacy
        "iexplore.exe",
        "MicrosoftEdge.exe",
        // Waterfox
        "waterfox",
        "waterfox.exe",
        // Librewolf
        "librewolf",
        "librewolf.exe",
        // Floorp
        "floorp",
        "floorp.exe",
        // Zen Browser
        "zen",
        "zen.exe",
    ];

    processes.iter().map(|s| s.to_lowercase()).collect()
}

/// Get default list of AI service process names to block
pub fn get_default_ai_processes() -> HashSet<String> {
    let processes = [
        // ChatGPT Desktop
        "chatgpt",
        "chatgpt.exe",
        "ChatGPT.app",
        // Claude Desktop
        "claude",
        "claude.exe",
        "Claude.app",
        // GitHub Copilot (standalone)
        "copilot",
        "copilot.exe",
        // Cursor (AI-powered editor)
        "cursor",
        "cursor.exe",
        "Cursor.app",
        // Codeium
        "codeium",
        "codeium.exe",
        // Tabnine
        "tabnine",
        "tabnine.exe",
        "TabNine.exe",
        // Pieces (AI code assistant)
        "pieces",
        "pieces.exe",
        "Pieces.app",
        // Raycast AI
        "raycast",
        "Raycast.app",
        // Notion AI (desktop app)
        "notion",
        "notion.exe",
        "Notion.app",
        // Obsidian (with AI plugins)
        // Note: Obsidian itself is not AI, but commonly used with AI plugins
        // Users can whitelist if needed
    ];

    processes.iter().map(|s| s.to_lowercase()).collect()
}

/// Get default list of AI service domains to block
pub fn get_default_ai_domains() -> HashSet<String> {
    let domains = [
        // OpenAI / ChatGPT
        "chat.openai.com",
        "chatgpt.com",
        "openai.com",
        "api.openai.com",
        // Anthropic / Claude
        "claude.ai",
        "anthropic.com",
        "api.anthropic.com",
        // Google AI
        "gemini.google.com",
        "bard.google.com",
        "ai.google",
        "aistudio.google.com",
        // Microsoft Copilot
        "copilot.microsoft.com",
        "bing.com/chat",
        "copilot.github.com",
        // Perplexity
        "perplexity.ai",
        // Poe
        "poe.com",
        // Character AI
        "character.ai",
        "beta.character.ai",
        // You.com
        "you.com",
        // Image generators
        "midjourney.com",
        "leonardo.ai",
        "ideogram.ai",
        "playground.ai",
        "dreamstudio.ai",
        "stability.ai",
        "dall-e.com",
        "craiyon.com",
        // Writing assistants
        "jasper.ai",
        "rytr.me",
        "copy.ai",
        "writesonic.com",
        "quillbot.com",
        // Code assistants
        "replit.com",
        "cursor.com",
        "codeium.com",
        "tabnine.com",
        "sourcegraph.com",
        // Other AI services
        "huggingface.co",
        "replicate.com",
        "runpod.io",
        "together.ai",
        "groq.com",
        "fireworks.ai",
        "cohere.com",
        "ai21.com",
    ];

    domains.iter().map(|s| s.to_lowercase()).collect()
}

/// Get default list of gaming website domains to block (150+ sites)
pub fn get_default_gaming_domains() -> HashSet<String> {
    let domains = [
        // ===== MAJOR GAMING PLATFORMS =====
        "steam.com",
        "steampowered.com",
        "store.steampowered.com",
        "steamcommunity.com",
        "steamcdn-a.akamaihd.net",
        "epicgames.com",
        "store.epicgames.com",
        "epicgamesstore.com",
        "gog.com",
        "gogalaxy.com",
        "battle.net",
        "blizzard.com",
        "activision.com",
        "callofduty.com",
        "origin.com",
        "ea.com",
        "electronicarts.com",
        "ubisoft.com",
        "uplay.com",
        "ubisoftconnect.com",
        "xbox.com",
        "playstation.com",
        "store.playstation.com",
        "nintendo.com",
        "nintendo.co.uk",
        "nintendo.eu",
        "humbleundle.com",
        "greenmangaming.com",
        "fanatical.com",
        "gamersgate.com",
        "indiegala.com",
        "g2a.com",
        "kinguin.net",
        "cdkeys.com",
        "eneba.com",
        "instant-gaming.com",

        // ===== GAME STREAMING =====
        "twitch.tv",
        "kick.com",
        "youtube.com/gaming",
        "gaming.youtube.com",
        "facebook.com/gaming",
        "fb.gg",
        "trovo.live",
        "dlive.tv",
        "caffeine.tv",
        "medal.tv",
        "streamlabs.com",
        "streamelements.com",
        "geforce.com/geforce-now",
        "play.geforcenow.com",
        "stadia.google.com",
        "xcloud.com",
        "xbox.com/play",
        "luna.amazon.com",
        "boosteroid.com",
        "shadow.tech",
        "parsec.app",

        // ===== BROWSER GAMES =====
        "poki.com",
        "poki.nl",
        "poki.fr",
        "poki.de",
        "poki.es",
        "miniclip.com",
        "kongregate.com",
        "crazygames.com",
        "armorgames.com",
        "newgrounds.com",
        "itch.io",
        "coolmathgames.com",
        "coolmath-games.com",
        "addictinggames.com",
        "y8.com",
        "friv.com",
        "kizi.com",
        "agame.com",
        "silvergames.com",
        "games.co.uk",
        "gameforge.com",
        "iogames.space",
        "io-games.io",
        "lagged.com",
        "gameflare.com",
        "gamepix.com",
        "gamedistribution.com",
        "gameanalytics.com",
        "primarygames.com",
        "arcadeprehacks.com",
        "unblockedgames.com",
        "unblockedgames66.com",
        "unblocked-games.com",
        "tyrone-unblocked-games.com",
        "sites.google.com/site/unblockedgame",
        "mathplayground.com",
        "abcya.com",
        "funbrain.com",
        "brainpop.com/games",
        "nick.com/games",
        "cartoonnetwork.com/games",
        "disney.com/games",
        "pbskids.org/games",
        "numuki.com",
        "twoplayergames.org",
        "1001games.com",
        "spilgames.com",
        "plinga.com",
        "gamesgames.com",
        "gamesfreak.net",
        "freegames.org",
        "onlinegames.io",
        "wanted5games.com",
        "bestgames.com",
        "plays.org",
        "now.gg",

        // ===== IO GAMES =====
        "agar.io",
        "slither.io",
        "diep.io",
        "krunker.io",
        "surviv.io",
        "zombsroyale.io",
        "moomoo.io",
        "skribbl.io",
        "shellshock.io",
        "ev.io",
        "venge.io",
        "1v1.lol",
        "buildnow.gg",
        "narrow.one",
        "territorial.io",
        "yohoho.io",
        "paper.io",
        "hole.io",
        "wormate.io",
        "littlebigsnake.com",
        "powerline.io",
        "lordz.io",
        "spinz.io",
        "wings.io",

        // ===== POPULAR GAME WEBSITES =====
        "roblox.com",
        "web.roblox.com",
        "minecraft.net",
        "classicminecraft.net",
        "leagueoflegends.com",
        "op.gg",
        "u.gg",
        "fortnite.com",
        "fortnitetracker.com",
        "valorant.com",
        "tracker.gg",
        "playoverwatch.com",
        "overwatchleague.com",
        "playvalorant.com",
        "counter-strike.net",
        "hltv.org",
        "faceit.com",
        "esea.net",
        "dota2.com",
        "dotabuff.com",
        "opendota.com",
        "apexlegends.com",
        "pubg.com",
        "escapefromtarkov.com",
        "worldoftanks.com",
        "worldofwarships.com",
        "warthunder.com",
        "genshin.hoyoverse.com",
        "hoyoverse.com",
        "mihoyo.com",
        "honkaistarrail.com",
        "pokemongo.com",
        "pokemon.com",
        "nianticlabs.com",
        "runescape.com",
        "oldschool.runescape.com",
        "finalfantasyxiv.com",
        "worldofwarcraft.com",
        "wowhead.com",
        "icy-veins.com",
        "lostark.com",
        "pathofexile.com",
        "diablo.com",
        "leaderboards.com",

        // ===== GAMING NEWS & COMMUNITIES =====
        "ign.com",
        "gamespot.com",
        "kotaku.com",
        "polygon.com",
        "pcgamer.com",
        "eurogamer.net",
        "rockpapershotgun.com",
        "gamesradar.com",
        "destructoid.com",
        "gameinformer.com",
        "gematsu.com",
        "siliconera.com",
        "dualshockers.com",
        "thegamer.com",
        "gamerant.com",
        "screenrant.com/gaming",
        "gamingbolt.com",
        "vg247.com",
        "pushsquare.com",
        "nintendolife.com",
        "pureplaystation.com",
        "reddit.com/r/gaming",
        "reddit.com/r/games",
        "reddit.com/r/pcgaming",
        "gamefaqs.com",
        "giantbomb.com",
        "metacritic.com/game",
        "opencritic.com",
        "howlongtobeat.com",
        "isthereanydeal.com",
        "gg.deals",
        "steamdb.info",
        "steamcharts.com",
        "steamspy.com",

        // ===== ESPORTS =====
        "esportsearnings.com",
        "liquipedia.net",
        "gosugamers.net",
        "esportstales.com",
        "theesportswriter.com",
        "esportsinsider.com",
        "dotesports.com",
        "dexerto.com",
        "ginx.tv",
        "redbull.com/gaming",
        "lolesports.com",
        "valorantesports.com",
        "csgo.com",
        "blast.tv",
        "esl.com",
        "eslgaming.com",

        // ===== GAME MODS & DOWNLOADS =====
        "nexusmods.com",
        "moddb.com",
        "curseforge.com",
        "thunderstore.io",
        "modrinth.com",
        "gamebanana.com",
        "modworkshop.net",
        "loverslab.com",
        "steamworkshopdownloader.io",
        "skymods.com",
        "gta5-mods.com",
        "pcgamingwiki.com",

        // ===== EMULATORS & ROMS =====
        "retroarch.com",
        "emulator-zone.com",
        "emulatorgames.net",
        "romspure.com",
        "romsmode.com",
        "romsgames.net",
        "vimm.net",
        "emuparadise.me",
        "coolrom.com",
        "loveroms.com",
        "romhustler.org",
        "ziperto.com",
        "nswgame.com",
        "nsw2u.com",
        "romsforever.com",
        "wowroms.com",
        "romulation.org",
        "retrostic.com",
        "gamulator.com",
        "dolphin-emu.org",
        "ppsspp.org",
        "cemu.info",
        "yuzu-emu.org",
        "ryujinx.org",
        "pcsx2.net",
        "rpcs3.net",
        "xenia.jp",
        "desmume.org",
        "mgba.io",

        // ===== GAMBLING & CASINO GAMES =====
        "stake.com",
        "roobet.com",
        "csgoroll.com",
        "gamdom.com",
        "rollbit.com",
        "duelbits.com",
        "csgoluck.com",
        "csgoempire.com",
        "skinclub.gg",

        // ===== GAME CHEATS & HACKS =====
        "unknowncheats.me",
        "mpgh.net",
        "aimjunkies.com",
        "iwantcheats.net",
        "gamepron.com",
        "cheatengine.org",
        "wemod.com",
        "flingtrainer.com",
        "cheathappens.com",
        "megadev.info",
        "plitch.com",

        // ===== VIRTUAL GOODS & TRADING =====
        "skinport.com",
        "bitskins.com",
        "dmarket.com",
        "buff.163.com",
        "cs.money",
        "tradeit.gg",
        "swap.gg",
        "skinbaron.de",
        "skinwallet.com",
        "lootbear.com",

        // ===== DISCORD GAME SERVERS =====
        "discord.com",
        "discord.gg",
        "discordapp.com",
        "discord.media",

        // ===== MISC GAMING =====
        "boardgamearena.com",
        "tabletopia.com",
        "tabletopsimulator.com",
        "chess.com",
        "lichess.org",
        "poker.com",
        "pokerstars.com",
        "888poker.com",
        "pogo.com",
        "arkadium.com",
        "zone.msn.com",
        "games.yahoo.com",
        "aol.com/games",
        "bigfishgames.com",
        "wildtangent.com",
        "gamehouse.com",
        "shockwave.com",
        "king.com",
        "zynga.com",
        "supercell.com",
        "rovio.com",
        "playrix.com",
        "kabam.com",
        "scopely.com",
        "jam-city.com",
    ];

    domains.iter().map(|s| s.to_lowercase()).collect()
}

/// Check if a process name matches any blocked process
pub fn is_process_blocked(
    process_name: &str,
    blocked_processes: &HashSet<String>,
    allowed_processes: &HashSet<String>,
) -> bool {
    let name_lower = process_name.to_lowercase();

    // Check whitelist first
    if allowed_processes.contains(&name_lower) {
        return false;
    }

    // Check if explicitly blocked
    if blocked_processes.contains(&name_lower) {
        return true;
    }

    // Check partial matches for gaming processes
    let gaming_keywords = ["steam", "epic", "origin", "battle.net", "roblox", "minecraft", "discord"];

    for keyword in gaming_keywords {
        if name_lower.contains(keyword) && !allowed_processes.iter().any(|p| name_lower.contains(p)) {
            return blocked_processes.iter().any(|p| p.contains(keyword));
        }
    }

    // Check partial matches for AI processes
    let ai_keywords = ["chatgpt", "claude", "copilot", "cursor", "codeium", "tabnine"];

    for keyword in ai_keywords {
        if name_lower.contains(keyword) && !allowed_processes.iter().any(|p| name_lower.contains(p)) {
            return blocked_processes.iter().any(|p| p.contains(keyword));
        }
    }

    false
}

/// Check if a domain matches any blocked domain
pub fn is_domain_blocked(
    domain: &str,
    blocked_domains: &HashSet<String>,
    allowed_domains: &HashSet<String>,
) -> bool {
    let domain_lower = domain.to_lowercase();

    // Check whitelist first
    if allowed_domains.contains(&domain_lower) {
        return false;
    }

    // Check for subdomain matches
    for allowed in allowed_domains {
        if domain_lower.ends_with(&format!(".{}", allowed)) || domain_lower == *allowed {
            return false;
        }
    }

    // Check if domain or parent domain is blocked
    for blocked in blocked_domains {
        if domain_lower == *blocked || domain_lower.ends_with(&format!(".{}", blocked)) {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_lists_not_empty() {
        assert!(!get_default_gaming_processes().is_empty());
        assert!(!get_default_ai_processes().is_empty());
        assert!(!get_default_ai_domains().is_empty());
        assert!(!get_default_gaming_domains().is_empty());
    }

    #[test]
    fn test_is_process_blocked() {
        let blocked = get_default_gaming_processes();
        let allowed = HashSet::new();

        assert!(is_process_blocked("steam.exe", &blocked, &allowed));
        assert!(is_process_blocked("Steam.exe", &blocked, &allowed));
        assert!(!is_process_blocked("notepad.exe", &blocked, &allowed));
    }

    #[test]
    fn test_is_domain_blocked() {
        let blocked = get_default_ai_domains();
        let allowed = HashSet::new();

        assert!(is_domain_blocked("chat.openai.com", &blocked, &allowed));
        assert!(is_domain_blocked("api.openai.com", &blocked, &allowed));
        assert!(!is_domain_blocked("google.com", &blocked, &allowed));
    }

    #[test]
    fn test_whitelist_overrides() {
        let blocked = get_default_gaming_processes();
        let mut allowed = HashSet::new();
        allowed.insert("steam.exe".to_string());

        assert!(!is_process_blocked("steam.exe", &blocked, &allowed));
    }
}
