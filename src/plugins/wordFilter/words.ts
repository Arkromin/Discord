/*
 * Discord, a modification for Discord's desktop app
 * Copyright (c) 2026 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export interface WordCategory {
    id: string;
    label: string;
    description: string;
    words: string[];
}

export const CATEGORIES: WordCategory[] = [
    {
        id: "insults",
        label: "Insultes (FR)",
        description: "Insultes courantes en français",
        words: [
            "connard", "connards", "connasse", "connasses", "conne", "enculé", "enculée", "enculés", "enculer", "enfoiré", "enfoirée", "enfoirés", "salaud", "salauds", "salope", "salopes", "salopard", "pute", "putes", "putain", "putains", "pétasse", "pétasses", "garce", "garces", "merde", "merdes", "merdique", "merdeux", "bordel", "batard", "bâtard", "bâtarde", "bâtards", "abruti", "abrutie", "abrutis", "crétin", "crétine", "crétins", "débile", "débiles", "idiot", "idiote", "idiots", "imbécile", "imbéciles", "andouille", "bouffon", "bouffonne", "bouffons", "trou du cul", "trou de balle", "tête de con", "tête de noeud", "fils de pute", "fils de chien", "sale chien", "sale pute", "ferme ta gueule", "ta gueule", "casse-couilles", "casse couilles", "couillon", "couillons", "branleur", "branleuse", "branlette", "branleurs", "bite", "bites", "couille", "couilles", "chier", "chiasse", "foutre", "nique", "niquer", "niqué", "niquez", "nique ta mère", "nique sa mère", "mange tes morts", "pourriture", "ordure", "raclure", "sous-merde", "sous merde", "tocard", "tocards", "taré", "tarée", "tarés", "cinglé", "cinglée", "dégénéré", "dégénérée", "attardé", "attardée", "attardés", "gogol", "triso", "minable", "minables", "enflure", "sac à merde", "sac à foutre", "va te faire foutre", "va te faire enculer", "vtff", "ducon", "dugland", "glandu", "glandeur", "pignouf", "bouseux", "gros porc", "grosse vache", "sale con", "sale conne", "crevard", "crevure", "charogne", "fumier", "bachi-bouzouk", "tapette"
        ]
    },
    {
        id: "abbreviations",
        label: "Abréviations / sigles",
        description: "ntm, fdp, tg, ptn, stfu, wtf…",
        words: [
            "ntm", "nstm", "fdp", "fdpt", "tg", "ftg", "ptn", "ptnn", "ptain", "pute", "pd", "tdc", "vtff", "vtf", "cnt", "enculé", "pttn", "nsm", "nsmm", "stfu", "wtf", "wth", "gtfo", "fck", "fuk", "fk", "fkn", "fcking", "fcku", "fuq", "kys", "kms", "mfer", "dgaf"
        ]
    },
    {
        id: "vulgar",
        label: "Vulgarités / sexuel",
        description: "Mots grossiers ou sexuels explicites",
        words: [
            "baiser ta mère", "baisé", "baiser tes morts", "niquer ta mère", "fellation", "sodomie", "sodomiser", "zob", "zobi", "burnes", "nichon", "nichons", "nibards", "cul", "culs", "foufoune", "paire de couilles", "foutre", "éjac", "éjaculer", "porno", "pornographie", "pornhub", "xxx", "onlyfans", "nudes", "nude", "masturbation", "masturber", "se branler", "je me branle", "godemiché", "sextoy", "anus", "anal", "baisable", "baisodrome"
        ]
    },
    {
        id: "discrimination",
        label: "Discrimination / propos haineux",
        description: "Insultes racistes, homophobes, sexistes, validistes",
        words: [
            "nègre", "négresse", "négro", "nègres", "negro", "nigger", "nigga", "niggers", "niggas", "nigg", "bamboula", "bougnoule", "bougnoules", "bicot", "bicots", "youpin", "youpine", "youpins", "sale juif", "sale arabe", "sale noir", "sale blanc", "sale français", "sale race", "sale pd", "sale chinois", "chintok", "chinetoque", "chinetoques", "niakoué", "niakoués", "bridé", "bridés", "gitan de merde", "crouille", "crouilles", "rital", "ritals", "polack", "boche", "boches", "sale rebeu", "sale rebeus", "sale négro", "pédé", "pédés", "pd de", "enculé de pédé", "fiotte", "fiottes", "tarlouze", "tarlouzes", "tafiole", "tafioles", "gouine", "gouines", "sale gouine", "travelo", "travelos", "trans de merde", "sale tapette", "sale pédé", "faggot", "faggots", "fag", "fags", "dyke", "tranny", "trannies", "retarded", "spastique", "spasmo", "sale handicapé", "sale femme", "féminazie", "féminazies", "sale féministe", "retourne dans ta cuisine", "sois belle et tais-toi", "sale muzz", "sale islamiste", "sale musulman", "sale terroriste", "heil hitler", "sieg heil", "nazi de merde", "sale nazi", "hitler avait raison", "sale bougnoule", "sale blanche", "sale gaulois", "sale toubab", "sale africain", "sale singe", "singe de merde"
        ]
    },
    {
        id: "english",
        label: "Insultes (EN)",
        description: "Insultes courantes en anglais",
        words: [
            "fuck", "fucks", "fucked", "fucker", "fuckers", "fucking", "motherfucker", "motherfuckers", "mother fucker", "fuck you", "fuck off", "fuck u", "shit", "shits", "shitty", "bullshit", "bitch", "bitches", "bitchy", "son of a bitch", "asshole", "assholes", "ass hole", "arse", "arsehole", "dick", "dicks", "dickhead", "dickheads", "cock", "cocks", "cocksucker", "pussy", "pussies", "cunt", "cunts", "whore", "whores", "slut", "sluts", "slutty", "bastard", "bastards", "damned", "dumbass", "dumb ass", "jackass", "jerkoff", "jerk off", "wanker", "wankers", "twat", "twats", "prick", "pricks", "douche", "douchebag", "douchebags", "scumbag", "scumbags", "moron", "morons", "idiot", "idiots", "losers", "retarded", "kill yourself", "go die", "die in a hole", "shut the fuck up", "piss off", "pissed off", "bollocks", "tits", "boobs", "blowjob", "handjob", "cum", "cumshot", "dildo"
        ]
    }
];

/** Mots très ambigus laissés volontairement de côté pour éviter les faux positifs : "pdr", "handicapé", "autiste", etc. */
export const ALL_CATEGORY_IDS = CATEGORIES.map(c => c.id);
