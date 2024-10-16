import React, { useState, useEffect } from 'react';

// Function to open YouTube Music with the specific song
const openYouTubeMusicPlayer = (songId) => {
    const url = `https://music.youtube.com/watch?v=${songId}`;
    window.open(url, '_blank');
};

// Enhance the thumbnail URL by adjusting width and height
const getEnhancedThumbnailUrl = (url) => {
    return url.replace(/w60-h60/, 'w544-h544');
};

const SongCard = ({ 
    song, 
    onPlayClick, 
    onToggleFavorite, 
    onOpenFavorites 
}) => {
    const enhancedThumbnailUrl = getEnhancedThumbnailUrl(song.thumbnailUrl);
    const [showPlaylists, setShowPlaylists] = useState(false);
    const [playlists, setPlaylists] = useState([]); // State to hold playlists
    const [isFavorite, setIsFavorite] = useState(false);

    // Effect to determine favorite status based on song's likedAt value
    useEffect(() => {
        if (song && typeof song.likedAt !== 'undefined') {
            setIsFavorite(song.likedAt !== null);
        }
    }, [song]);

    // Prepare the song data to be sent to the server
    const prepareSongData = () => {
        return {
            songId: song.id, // Assuming song.id is YouTube's videoId
            title: song.title || "Unknown Title",
            artistsText: song.artistsText || "Unknown Artist",
            durationText: song.durationText || "0:00", // Default duration
            thumbnailUrl: song.thumbnailUrl || "",
            totalPlayTimeMs: 0, // Default playtime
        };
    };
	
	// Fetch playlists when the component mounts
    useEffect(() => {
        const fetchPlaylists = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/playlists');
                if (!response.ok) {
                    throw new Error('Failed to fetch playlists');
                }
                const data = await response.json();
                setPlaylists(data.playlists);
            } catch (error) {
                console.error('Error fetching playlists:', error);
            }
        };

        fetchPlaylists();
    }, []);

    // Handle favorite toggle functionality
    const handleFavoriteToggle = async () => {
        const songData = prepareSongData(); // Prepare the song data
        try {
            const response = await fetch(`http://localhost:5000/api/songs/${song.id}/favorite`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(songData), // Send song data as request body
            });

            if (!response.ok) {
                const errorMessage = await response.text();
                throw new Error(`Error: ${response.statusText} - ${errorMessage}`);
            }

            const result = await response.json(); // Get the result message
            setIsFavorite(result.favorite); // Update local favorite state based on the response
            if (typeof onToggleFavorite === 'function') {
                onToggleFavorite(song.id); // Call callback function if provided
            }

            // Open the Favorites tab after toggling
            if (typeof onOpenFavorites === 'function') {
                onOpenFavorites(); // Call the callback to open the Favorites tab
            }
        } catch (error) {
            console.error('Error toggling favorite status:', error.message);
        }
    };

// Add song to Playlist
const onAddToPlaylist = async (songId, playlistId) => {
    const songData = prepareSongData(); // Prepare the song data
    try {
        // Debugging log to ensure we're passing the correct values
        console.log('Adding song to playlist with:', { songId, playlistId });

        const response = await fetch(`http://localhost:5000/api/playlists/${playlistId}/songs/${songId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(songData), // Send song data as request body
        });

        if (!response.ok) {
            throw new Error('Failed to add song to playlist');
        }

        console.log(`Song ${songId} added to playlist ${playlistId} successfully`);
        setShowPlaylists(false); // Close dropdown after adding
    } catch (error) {
        console.error('Error adding song to playlist:', error);
    }
};


    return (
        <div className="relative group bg-gray-800 p-4 rounded-lg shadow-lg overflow-hidden transition-transform transform hover:scale-105 hover:shadow-xl">
            <img
                src={enhancedThumbnailUrl}
                alt={song.title}
                className="w-full h-32 sm:h-48 md:h-56 object-cover rounded transition-filter filter group-hover:brightness-75"
            />
            <div className="absolute top-3 left-3 flex flex-col items-center space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Favorite Button */}
                <button
                    onClick={handleFavoriteToggle}
                    className="flex items-center justify-center p-2 rounded-full bg-black transition-transform transform hover:scale-110"
                    title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                >
                    {/* Heart Icon */}
                    <span
                        className="material-icons"
                        style={{
                            color: isFavorite ? 'red' : 'transparent', // Red fill if favorite
                            fontSize: '24px',
                            position: 'absolute', // Overlap outline
                        }}
                    >
                        favorite
                    </span>
                    <span
                        className="material-icons"
                        style={{
                            color: 'red', // Red outline
                            fontSize: '24px',
                        }}
                    >
                        favorite_border
                    </span>
                </button>

                {/* Add to Playlist Button */}
                <button
                    onClick={() => setShowPlaylists(!showPlaylists)}
                    className="flex items-center justify-center p-2 rounded-full bg-black transition-transform transform hover:scale-110"
                    title="Add to Playlist"
                >
                    <span className="material-icons" style={{ color: 'yellow', fontSize: '24px' }}>
                        add
                    </span>
                </button>

				{/* Playlist Dropdown */}
				{showPlaylists && (
					<div className="absolute top-1 right-0 transform translate-x-full mt-2 bg-gray-700 text-white rounded-lg shadow-lg p-2 z-10">
						{playlists.length > 0 ? (
							playlists.map((playlist) => (
								<button
									key={playlist.id}
									onClick={() => {
										onAddToPlaylist(song.id, playlist.id);
									}}
									className="block text-left px-4 py-2 hover:bg-gray-600 rounded-md w-full"
								>
									{playlist.name}
								</button>
							))
						) : (
							<p className="text-sm text-gray-400">No playlists found</p>
						)}
					</div>
				)}

            </div>

            {/* Open YouTube Music Button */}
            <div className="absolute top-3 right-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => openYouTubeMusicPlayer(song.id)}
                    className="flex items-center justify-center p-2 transition-transform transform hover:scale-110"
                    title="Open in YouTube Music"
                >
                    <span className="material-icons" style={{ color: 'white', fontSize: '24px' }}>open_in_new</span>
                </button>
            </div>

            {/* Play Button */}
            <div className="absolute bottom-4 right-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-black p-2 sm:p-3 md:p-4 rounded-full">
                    <button
                        onClick={() => onPlayClick(song.id)}
                        className="text-green-500 text-xl sm:text-2xl md:text-3xl flex items-center justify-center transition-transform transform hover:scale-110"
                    >
                        <span className="material-icons">play_arrow</span>
                    </button>
                </div>
            </div>

            {/* Song Info */}
            <div className="mt-2 text-white">
                <h3 className="text-lg font-semibold truncate">{song.title}</h3>
                <div className="flex items-center justify-between">
                    {song.artistsText ? (
                        <>
                            <p className="text-gray-400 truncate">{song.artistsText}</p>
                            <span className="text-gray-400 ml-auto">{song.durationText}</span>
                        </>
                    ) : (
                        <span className="text-gray-400">{song.durationText}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SongCard;
