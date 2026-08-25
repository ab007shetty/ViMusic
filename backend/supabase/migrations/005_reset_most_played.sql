-- 005_reset_most_played.sql
-- One-time data reset, not a schema change: zeroes out accumulated
-- listening-time data for every user, across every song, so "Most Played"
-- starts fresh. Does not touch favorites (likedAt), recently-played
-- (lastPlayedAt), or any other song data — only the play-time counter.
-- Run this once by hand in the Supabase SQL editor.

UPDATE song SET "totalPlayTimeMs" = 0;
