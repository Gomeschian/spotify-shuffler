import { fetchScrobbles } from "./lastfm.js";

document.addEventListener("DOMContentLoaded", function () {
  const clientId = "14d1be042f9746849b214351c89cdda4";
  const isLocalhost = window.location.hostname === "localhost";
  const redirectUri = isLocalhost
    ? "http://localhost:8080/"
    : "https://gomeschian.github.io/spotify-shuffler/";
  const scopes =
    "playlist-read-private playlist-modify-public playlist-modify-private";

  const lastFMKey = "dbb183026f5caf77c9d896eca1dde44d";

  const loginSection = document.getElementById("login-section");
  const playlistsSection = document.getElementById("playlists-section");

  const isAuthenticated = () => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    return params.has("access_token");
  };

  const redirectToAuthorization = () => {
    window.location.href = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&response_type=token`;
  };

  const accessToken = new URLSearchParams(
    window.location.hash.substring(1)
  ).get("access_token");

  const fetchPlaylists = async () => {
    try {
      if (!accessToken) {
        throw new Error("Access token not found or invalid.");
      }

      document.getElementById("login-section").innerText =
        "Fetching playlists...may take a minute...";
      let allPlaylists = [];
      let limit = 50;
      let offset = 0;

      while (true) {
        const response = await fetch(
          `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`,
          {
            headers: {
              Authorization: "Bearer " + accessToken,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch playlists.");
        }

        const data = await response.json();
        allPlaylists.push(...data.items);

        if (data.next) {
          offset += limit;
          await sleep(100); // Introduce a delay of 100 milliseconds between batches
        } else {
          break;
        }
      }

      displayPlaylists(allPlaylists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      showAlert("Failed to fetch playlists. Please try again.", "error");
    }
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const displayPlaylists = (playlists) => {
    const playlistList = document.getElementById("playlist-list");

    if (playlists.length === 0) {
      document.getElementById("login-section").innerText = "No playlists found";
    } else {
      playlists.forEach((playlist) => {
        const listItem = document.createElement("li");
        listItem.className =
          "flex items-center justify-between bg-white p-2 rounded shadow";
        listItem.innerHTML = `
              <span class="text-gray-800">${playlist.name}</span>
              <button class="bg-green-500 text-white px-3 py-1 rounded shuffle-btn" data-id="${playlist.id}">Shuffle Playlist</button>
              <button class="bg-blue-500 text-white px-3 py-1 rounded remove-duplicates-btn" data-id="${playlist.id}">Remove Duplicates</button>
              <button class="bg-red-500 text-white px-3 py-1 rounded remove-recent-scrobbles-btn" data-id="${playlist.id}">Remove Recently Played (Last.fm)</button>
          `;

        // Create a div for removed duplicates
        const removedDuplicatesDiv = document.createElement("div");
        removedDuplicatesDiv.className = "text-sm text-gray-500 mt-2";
        removedDuplicatesDiv.style.display = "none"; // Hide initially

        listItem.appendChild(removedDuplicatesDiv);

        playlistList.appendChild(listItem);

        // Create a div for removed recent scrobbles
        const removedRecentScrobblesDiv = document.createElement("div");
        removedRecentScrobblesDiv.className = "text-sm text-gray-500 mt-2";
        removedRecentScrobblesDiv.style.display = "none"; // Hide initially

        // Add event listeners to shuffle buttons
        const shuffleButton = listItem.querySelector(".shuffle-btn");
        shuffleButton.addEventListener("click", () => {
          const playlistId = shuffleButton.getAttribute("data-id");
          shufflePlaylist(playlistId);
        });

        // Add event listeners to remove duplicates buttons
        const removeDuplicatesButton = listItem.querySelector(
          ".remove-duplicates-btn"
        );
        removeDuplicatesButton.addEventListener("click", () => {
          const playlistId = removeDuplicatesButton.getAttribute("data-id");
          removeDuplicates(playlistId, removedDuplicatesDiv);
        });

        // Add event listeners to remove recent plays buttons
        const removeRecentScrobblesButton = listItem.querySelector(
          ".remove-recent-scrobbles-btn"
        );
        removeRecentScrobblesButton.addEventListener("click", () => {
          const playlistId =
            removeRecentScrobblesButton.getAttribute("data-id");
          removeRecentScrobbles(playlistId);
        });
      });

      document.getElementById("login-section").innerText =
        "Ready to Shuffle or Remove Duplicates";
    }
  };

  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const shufflePlaylist = async (playlistId) => {
    showAlert(
      "Shuffling may take a minute, keep the page open and don't click any other buttons until the shuffle is complete."
    );
    document.getElementById("login-section").innerText =
      "Shuffling...may take a minute...";
    try {
      const originalTracks = await getAllPlaylistTracks(playlistId);

      // Shuffle the tracks
      const shuffledTracks = shuffleArray(originalTracks);

      // Update the Spotify playlist with the shuffled tracks
      await updatePlaylist(playlistId, shuffledTracks);

      showAlert(
        "Playlist shuffled successfully! May need to refresh/reload your playlist",
        "success"
      );
    } catch (error) {
      console.error("Error shuffling playlist:", error);
      showAlert("Failed to shuffle playlist. Please try again.", "error");
    }
    document.getElementById("login-section").innerText =
      "Ready to Shuffle or Remove Duplicates";
  };

  const removeDuplicates = async (playlistId, removedDuplicatesDiv) => {
    showAlert(
      "Removing duplicates may take a minute, keep the page open and don't click any other buttons until the process is complete."
    );
    document.getElementById("login-section").innerText =
      "Removing duplicates...may take a minute...";

    try {
      const originalTracks = await getAllPlaylistTracks(playlistId);

      // Find and remove duplicates
      const { uniqueTracks, removedDuplicates } =
        findAndRemoveDuplicates(originalTracks);

      // Update the Spotify playlist with the unique tracks
      await updatePlaylist(playlistId, uniqueTracks);

      showAlert(
        `Duplicates processed successfully! Found and removed ${removedDuplicates.length} duplicate tracks. May need to refresh/reload your playlist`,
        "success"
      );

      // Display removed duplicates in the corresponding div
      if (removedDuplicates.length > 0) {
        removedDuplicatesDiv.style.display = "block";
        removedDuplicatesDiv.innerHTML = `
  <p>Removed Duplicates:</p>
  <ol>
      ${removedDuplicates
        .map(
          (track, index) =>
            `<li>${index + 1}. ${track.track.artists[0].name} - ${
              track.track.name
            }, Album: ${track.track.album.name} (URI: ${track.track.uri})</li>`
        )
        .join("")}
  </ol>`;
      } else {
        removedDuplicatesDiv.style.display = "none";
      }
    } catch (error) {
      console.error("Error removing duplicates:", error);
      showAlert("Failed to remove duplicates. Please try again.", "error");
    }

    document.getElementById("login-section").innerText =
      "Ready to Shuffle or Remove Duplicates";
  };

  const findAndRemoveDuplicates = (tracks) => {
    const uniqueTracks = [];
    const removedDuplicates = [];
    const idMap = new Map();
    const fullKeyMap = new Map();

    tracks.forEach((track) => {
      const idKey = track.track.uri;
      const fullKey = `${track.track.name}-${track.track.artists[0].name}-${track.track.album.name}-${track.track.duration_ms}`;

      if (!idMap.has(idKey)) {
        idMap.set(idKey, true);
        if (!fullKeyMap.has(fullKey)) {
          fullKeyMap.set(fullKey, true);
          uniqueTracks.push(track);
        } else {
          removedDuplicates.push(track);
        }
      } else {
        removedDuplicates.push(track);
      }
    });

    return { uniqueTracks, removedDuplicates };
  };

  const updatePlaylist = async (playlistId, tracks) => {
    try {
      const chunkSize = 100;
      const totalChunks = Math.ceil(tracks.length / chunkSize);
      const rateLimitDelay = 1000 / 15; // 15 requests per second

      // Replace the first chunk
      const firstChunk = tracks.slice(0, chunkSize);
      await replacePlaylistTracks(playlistId, firstChunk);

      // If there are additional chunks, add them to the playlist
      for (let i = 1; i < totalChunks; i++) {
        // Add rate-limiting delay
        await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));

        const start = i * chunkSize;
        const end = (i + 1) * chunkSize;
        const additionalChunk = tracks.slice(start, end);
        await addTracksToPlaylist(playlistId, additionalChunk);
      }
    } catch (error) {
      console.error("Error updating playlist:", error);
      throw error;
    }
  };

  const replacePlaylistTracks = async (playlistId, tracks) => {
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          uris: tracks.map((track) => track.track.uri),
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      console.error("Error replacing playlist tracks:", data);
      throw new Error(
        `Failed to replace playlist tracks. ${data.error.message}`
      );
    }
  };

  const addTracksToPlaylist = async (playlistId, tracks) => {
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          uris: tracks.map((track) => track.track.uri),
        }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      console.error("Error adding tracks to playlist:", data);
      throw new Error(
        `Failed to add tracks to playlist. ${data.error.message}`
      );
    }
  };

  const getAllPlaylistTracks = async (playlistId) => {
    let allTracks = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

    while (url) {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch playlist tracks.");
      }

      const data = await response.json();
      allTracks = allTracks.concat(data.items);

      url = data.next; // Set the next URL for the next iteration
    }

    return allTracks;
  };

// Refactored code with console.log statements for debugging

const removeRecentScrobbles = async (playlistId) => {
  try {
    const tracksToRemove = [];

    const lastFMUsername = prompt("Enter Last.fm username: ");

    const playlistTracks = await getAllPlaylistTracks(playlistId);
    const recentScrobbles = await fetchScrobbles(lastFMKey, lastFMUsername);

    playlistTracks.forEach((track) => {
      recentScrobbles.forEach((scrobble) => {
        console.log("Track:", track);
        console.log("Scrobble:", scrobble);

        if (
          track.trackName.toLowerCase().trim() ===
            scrobble.trackName.toLowerCase().trim() &&
          track.artist.toLowerCase().trim() ===
            scrobble.artist.toLowerCase().trim() &&
          track.album.toLowerCase().trim() ===
            scrobble.album.toLowerCase().trim()
        ) {
          tracksToRemove.push(track);
        }
      });
    });

    const chunkSize = 100;
    const totalChunks = Math.ceil(tracksToRemove.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = (i + 1) * chunkSize;
      const chunk = tracksToRemove.slice(start, end);

      console.log("Chunk:", chunk);

      await removeTracksFromPlaylist(playlistId, chunk);
    }

    const removedTracksMessage =
      tracksToRemove.length > 0
        ? `Removed ${
            tracksToRemove.length
          } track(s) from the playlist:\n\n${tracksToRemove
            .map(
              (track) =>
                `${track.trackName} - ${track.artist} - ${track.album}`
            )
            .join("\n")}`
        : "No recent scrobbles found in the playlist.";

    console.log("Removed Tracks Message:", removedTracksMessage);

    return alert(removedTracksMessage);
  } catch (error) {
    console.error("Error removing tracks from playlist:", error);
    throw error;
  }
};

const removeTracksFromPlaylist = async (playlistId, tracksToRemove) => {
  let success = false;

  while (!success) {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            tracks: tracksToRemove.map((track) => ({ uri: track.track.uri })),
          }),
        }
      );

      if (response.ok) {
        // Request was successful, exit the loop
        success = true;
        console.log("Tracks removed successfully");
      } else {
        // Request failed, retry after a delay
        console.log("Request failed, retrying after 1 second...");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before retrying
      }
    } catch (error) {
      // Error occurred, retry after a delay
      console.log("Error occurred, retrying after 1 second...");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before retrying
    }
  }
};

  const showAlert = (message, type) => {
    alert(message); // You can replace this with a more sophisticated alert/notification UI
  };

  if (isAuthenticated()) {
    playlistsSection.style.display = "block";
    fetchPlaylists();
  } else {
    redirectToAuthorization();
  }
});
