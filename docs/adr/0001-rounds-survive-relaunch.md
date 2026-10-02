# Rounds survive relaunch, and a submitted result always counts

A force-quit used to reset the board while keeping the secret word, so a player could get fresh attempts at a word they had partly or fully solved, never lose a streak, and lose power-ups they had paid for. We decided the round is persisted and restored exactly where it was left: submitted guesses, the guess being typed, retained guesses, Hint ghosts, Darts eliminations and the retries already used. A result counts the moment its guess is submitted, so a relaunch during the reveal or the win celebration continues as that win or loss.

## Considered Options

- **Count an abandoned round as a loss**: rejected; a crash or the OS killing the app in the background would cost the player a streak.
- **Keep the fresh-board behaviour**: rejected; it made force-quitting an exploit for both the streak and the economy.
