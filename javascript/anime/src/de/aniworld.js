const mangayomiSources = [{
    "name": "AniWorld",
    "lang": "de",
    "baseUrl": "https://aniworld.to",
    "apiUrl": "",
    "iconUrl": "https://raw.githubusercontent.com/kodjodevf/mangayomi-extensions/main/javascript/icon/de.aniworld.png",
    "typeSource": "single",
    "isManga": false,
    "isNsfw": false,
    "version": "0.0.26",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "anime/src/de/aniworld.js"
}];

class DefaultExtension extends MProvider {
    async getPopular(page) {
        const baseUrl = this.source.baseUrl;
        const res = await new Client().get(`${baseUrl}/beliebte-animes`);
        const elements = new Document(res.body).select("div.seriesListContainer div");
        const list = [];
        for (const element of elements) {
            const linkElement = element.selectFirst("a");
            const name = element.selectFirst("h3").text;
            const imageUrl = baseUrl + linkElement.selectFirst("img").attr("data-src");
            const link = linkElement.attr("href");
            list.push({ name, imageUrl, link });
        }
        return {
            list: list,
            hasNextPage: false
        }
    }
    async getLatestUpdates(page) {
        const baseUrl = this.source.baseUrl;
        const res = await new Client().get(`${baseUrl}/neu`);
        const elements = new Document(res.body).select("div.seriesListContainer div");
        const list = [];
        for (const element of elements) {
            const linkElement = element.selectFirst("a");
            const name = element.selectFirst("h3").text;
            const imageUrl = baseUrl + linkElement.selectFirst("img").attr("data-src");
            const link = linkElement.attr("href");
            list.push({ name, imageUrl, link });
        }
        return {
            list: list,
            hasNextPage: false
        }
    }
    async search(query, page, filters) {
        const baseUrl = this.source.baseUrl;
        const res = await new Client().get(`${baseUrl}/animes`);
        const elements = new Document(res.body).select("#seriesContainer > div > ul > li > a").filter(e => e.attr("title").toLowerCase().includes(query.toLowerCase()));
        const list = [];
        for (const element of elements) {
            const name = element.text;
            const link = element.attr("href");
            const img = new Document((await new Client().get(baseUrl + link)).body).selectFirst("div.seriesCoverBox img").attr("data-src");
            const imageUrl = baseUrl + img;
            list.push({ name, imageUrl, link });
        }
        return {
            list: list,
            hasNextPage: false
        }
    }
    async getDetail(url) {
        const baseUrl = this.source.baseUrl;
        const res = await new Client().get(baseUrl + url);
        const document = new Document(res.body);
        const imageUrl = baseUrl +
            document.selectFirst("div.seriesCoverBox img").attr("data-src");
        const name = document.selectFirst("div.series-title h1 span").text;
        const genre = document.select("div.genres ul li").map(e => e.text);
        const description = document.selectFirst("p.seri_des").attr("data-full-description");
        const produzent = document.select("div.cast li")
            .filter(e => e.outerHtml.includes("Produzent:"));
        let author = "";
        if (produzent.length > 0) {
            author = produzent[0].select("li").map(e => e.text).join(", ");
        }
        const seasonsElements = document.select("#stream > ul:nth-child(1) > li > a");
        let episodes = [];
        for (const element of seasonsElements) {
            const eps = await this.parseEpisodesFromSeries(element);
            for (const ep of eps) {
                episodes.push(ep);
            }
        }
        episodes.reverse();

        return {
            name, imageUrl, description, author, status: 5, genre, episodes
        };
    }
    async parseEpisodesFromSeries(element) {
        const seasonId = element.getHref;
        const res = await new Client().get(this.source.baseUrl + seasonId);
        const episodeElements = new Document(res.body).select("table.seasonEpisodesList tbody tr");
        const list = [];
        for (const episodeElement of episodeElements) {
            list.push(this.episodeFromElement(episodeElement));
        }
        return list;
    }
    episodeFromElement(element) {
        let name = "";
        let url = "";
        if (element.selectFirst("td.seasonEpisodeTitle a").attr("href").includes("/film")) {
            const num = element.attr("data-episode-season-id");
            name = `Film ${num}` + " : " + element.selectFirst("td.seasonEpisodeTitle a span").text;
            url = element.selectFirst("td.seasonEpisodeTitle a").attr("href");
        } else {
            const season =
                element.selectFirst("td.seasonEpisodeTitle a").attr("href").substringAfter("staffel-").substringBefore("/episode");;
            const num = element.attr("data-episode-season-id");
            name = `Staffel ${season} Folge ${num}` + " : " + element.selectFirst("td.seasonEpisodeTitle a span").text;
            url = element.selectFirst("td.seasonEpisodeTitle a").attr("href");
        }
        if (name.length > 0 && url.length > 0) {
            return { name, url }
        }
        return {}
    }
    getRandomString(length) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
        let result = "";
        for (let i = 0; i < length; i++) {
            const random = Math.floor(Math.random() * 61);
            result += chars[random];
        }
        return result;
    }
    async doodExtractor(url, quality) {
        let response = await new Client({ 'useDartHttpClient': true, "followRedirects": false }).get(url);
        while("location" in response.headers) {
            response = await new Client({ 'useDartHttpClient': true, "followRedirects": false }).get(response.headers.location);
        }
        const newUrl = response.request.url;
        const doodhost = newUrl.match(/https:\/\/(.*?)\//, newUrl)[0].slice(8, -1);
        const md5 = response.body.match(/'\/pass_md5\/(.*?)',/, newUrl)[0].slice(11, -2);
        const token = md5.substring(md5.lastIndexOf("/") + 1);
        const expiry = new Date().valueOf();
        const randomString = this.getRandomString(10);
    
        response = await new Client().get(`https://${doodhost}/pass_md5/${md5}`, {"Referer": newUrl});
        const videoUrl = `${response.body}${randomString}?token=${token}&expiry=${expiry}`;
        const headers = { "User-Agent": "Mangayomi", "Referer": doodhost };
        return [{ url: videoUrl, originalUrl: videoUrl, headers: headers, quality }];
    }
    async vidozaExtractor(url, quality) {
        let response = await new Client({ 'useDartHttpClient': true, "followRedirects": true }).get(url);
        const videoUrl = response.body.match(/https:\/\/\S*\.mp4/)[0];
        return [{ url: videoUrl, originalUrl: videoUrl, quality }];
    }
    async getVideoList(url) {
        const baseUrl = this.source.baseUrl;
        const res = await new Client().get(baseUrl + url);
        const document = new Document(res.body);
        const redirectlink = document.select("ul.row li");
        const preference = new SharedPreferences();
        const hosterSelection = preference.get("hoster_selection_new");
        const videos = [];
        for (const element of redirectlink) {
            try {
                const langkey = element.attr("data-lang-key");
                let language = "";
                if (langkey.includes("3")) {
                    language = "Deutscher Sub";
                } else if (langkey.includes("1")) {
                    language = "Deutscher Dub";
                } else if (langkey.includes("2")) {
                    language = "Englischer Sub";
                }
                const redirectgs = baseUrl + element.selectFirst("a.watchEpisode").attr("href");
                const hoster = element.selectFirst("a h4").text;

                if (hoster == "Streamtape" && hosterSelection.includes("Streamtape")) {
                    const location = (await new Client({ 'useDartHttpClient': true, "followRedirects": false }).get(redirectgs)).headers.location;
                    const quality = `${language} - Streamtape`;
                    const vids = await streamTapeExtractor(location, quality);
                    for (const vid of vids) {
                        videos.push(vid);
                    }
                } else if (hoster == "VOE" && hosterSelection.includes("VOE")) {
                    const location = (await new Client({ 'useDartHttpClient': true, "followRedirects": false }).get(redirectgs)).headers.location;
                    const quality = `${language} - `;
                    const vids = await voeExtractor(location, quality);
                    for (const vid of vids) {
                        videos.push(vid);
                    }
                } else if (hoster == "Vidoza" && hosterSelection.includes("Vidoza")) {
                    const location = (await new Client({ 'useDartHttpClient': true, "followRedirects": false }).get(redirectgs)).headers.location;
                    const quality = `${language} - Vidoza`;
                    const vids = await this.vidozaExtractor(location, quality);
                    for (const vid of vids) {
                        videos.push(vid);
                    }
                } else if (hoster == "Doodstream" && hosterSelection.includes("Doodstream")) {
                    const location = (await new Client({ 'useDartHttpClient': true, "followRedirects": false }).get(redirectgs)).headers.location;
                    const quality = `${language} - Doodstream`;
                    const vids = await this.doodExtractor(location, quality);
                    for (const vid of vids) {
                        videos.push(vid);
                    }
                }
            } catch (_) {

            }
        }
        return this.sortVideos(videos);
    }
    sortVideos(videos) {
        const preference = new SharedPreferences();
        const hoster = preference.get("preferred_hoster_new");
        const subPreference = preference.get("preferred_lang");
        videos.sort((a, b) => {
            let qualityMatchA = 0;
            if (a.quality.includes(hoster) &&
                a.quality.includes(subPreference)) {
                qualityMatchA = 1;
            }
            let qualityMatchB = 0;
            if (b.quality.includes(hoster) &&
                b.quality.includes(subPreference)) {
                qualityMatchB = 1;
            }
            return qualityMatchB - qualityMatchA;
        });
        return videos;
    }
    getSourcePreferences() {
        return [
            {
                "key": "preferred_lang",
                "listPreference": {
                    "title": "Bevorzugte Sprache",
                    "summary": "",
                    "valueIndex": 0,
                    "entries": [
                        "Deutscher Sub",
                        "Deutscher Dub",
                        "Englischer Sub"
                    ],
                    "entryValues": [
                        "Deutscher Sub",
                        "Deutscher Dub",
                        "Englischer Sub"
                    ]
                }
            },
            {
                "key": "preferred_hoster_new",
                "listPreference": {
                    "title": "Standard-Hoster",
                    "summary": "",
                    "valueIndex": 0,
                    "entries": [
                        "Streamtape",
                        "VOE",
                        "Vidoza", "Doodstream"
                    ],
                    "entryValues": [
                        "Streamtape",
                        "VOE",
                        "Vidoza", "Doodstream"
                    ]
                }
            },
            {
                "key": "hoster_selection_new",
                "multiSelectListPreference": {
                    "title": "Hoster auswählen",
                    "summary": "",
                    "entries": [
                        "Streamtape",
                        "VOE",
                        "Vidoza", "Doodstream"
                    ],
                    "entryValues": [
                        "Streamtape",
                        "VOE",
                        "Vidoza", "Doodstream"
                    ],
                    "values": [
                        "Streamtape",
                        "VOE",
                        "Vidoza", "Doodstream"
                    ]
                }
            }
        ];
    }
}
