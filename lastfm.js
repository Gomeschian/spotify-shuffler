export const fetchScrobbles = async (
  apiKey,
  username,
  page = 1,
  limit = 200,
  allScrobbles = []
) => {
  try {
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 3); // Last three months

    const fromTimestamp = Math.floor(fromDate.getTime() / 1000);

    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${apiKey}&format=json&page=${page}&limit=${limit}&from=${fromTimestamp}`
    );
    const data = await response.json();

    if (data.recenttracks) {
      const scrobbles = data.recenttracks.track
        ? data.recenttracks.track.map((track) => ({
            artist: track.artist["#text"],
            trackName: track.name,
            album: track.album["#text"],
            date: track.date ? new Date(track.date["#text"]) : null,
          }))
        : [];

      const totalScrobbles = data.recenttracks["@attr"]
        ? parseInt(data.recenttracks["@attr"].total, 10)
        : 0;

      console.log(
        `Page ${page}: Fetched ${scrobbles.length} scrobbles. Total Scrobbles: ${totalScrobbles}`
      );

      allScrobbles.push(...scrobbles);

      if (scrobbles.length > 0 && scrobbles.length < totalScrobbles) {
        // Fetch next page
        console.log("Fetching next page...");
        await fetchScrobbles(page + 1, limit, allScrobbles);
      } else {
        console.log("All scrobbles fetched.");
        return allScrobbles;
      }
    } else {
      console.error("Error fetching scrobbles:", data);
    }
  } catch (error) {
    console.error("Error fetching scrobbles:", error);
  }
};
