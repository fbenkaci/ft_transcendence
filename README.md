# This project has been created as part of the 42 curriculum by Hguiller, Molapoug, Miltavar, Fbenkaci

# Description

## ft_transcendance

Transcendance is a web game with an complex systeme of tournament, player vs AI, blockchain history match, PVE, PVP, with a social friendship relation and grafana.

# Instructions

## Compile

```bash
make
```

## Logs
```bash
make logs
```

## Down
```bash
make down
```

## Link of the Website

to test the front : [https://localhost:8443](https://localhost:8443)


## 📚 Resources

Here is a curated list of the essential resources and documentation that helped build this Website.

### 🌐 Code ressources
* **[Complet cours about TS](http://fr.scribd.com/document/535050709/Cours-TypeScript) :** an complet cours about how coding in TS
* **[Doc Django](https://django.readthedocs.io/en/stable/contents.html) :** full django documentation.
* **[Css style](https://uiverse.io/):** an website for the frontweb ellements.
* **[Colors](https://coolors.co/) :** to get the best combinaision of colors.
* **[How to do a smart contract](https://docs.soliditylang.org/en/latest/introduction-to-smart-contracts.html) :** The "best" way to do a smart contract.

### 🤖 AI Usage
* Gemini
* Copilot
* ChatGPT
* coding assist
* debugging
* understand how website works
* devops ai assist


___


# Documentation :

## API Functions:

API routes of the backend are defines in the **backend/backend/urls.py** file, this file calls all api routes lige **api/login/** who get calls buy **backend/views.py**, the **backend/views.py** use the django REST Framework to create (GET, POST) and **@permission_classes / @authentification_classes** to secure api routes with JWT tokens

## Endpoint (backend/views.py):
this file contain logique of HTTP requests works

### auth and users

```py
def RegisterView(request):
```
* Create new user, profile, check mail and validity of password
* Methode: POST (public)

```py
def custom_login(request):
```
* Auth user, if 2FA (double auth) is true that return a flag who ask code else return a token JWT (access and refresh)
* Methode: POST (public)

```py
def verify_2fa_login(request):
```
* Check TOTP (Time-Based One-Time Password) given when connexion buy generating token JWT if 2FA is true
* Methode: GET (public)

### Profile management

```py
def get_user_profile(request):
```
* Role: Retrieve the data of the connected user's profile (victory/defeat statistics, avatar URL, 2FA status)
* Method: GET (Protected)

```py
def update_profile(request):
```
* Role: Allows the user to update the password (after verifying the old one) and/or upload a new avatar (limited to 5 MB and certain image formats)
* Method: POST (Protected)

#### 2FA management (Double Authentication)

```py
def enable_2fa(request):
```
* Role: Generates a `pyotp` secret and a configuration URI (for Google Authenticator, for example) to initialize 2FA
* Method: POST (Protected)

```py
def activate_2fa(request):
```
* Role: Validates the first 2FA code to permanently activate it on the profile
* Method: POST (Protected)

```py
def disable_2fa(request):
```
* Role: Disables 2FA and removes the associated secret from the profile
* Method: POST (Protected)

#### Friend system

```py
def get_friends_list(request):
```
* Role: Lists the accepted friends of the user

```py
def send_friend_request(request, username):
```
* Role: Sends a friend request. Verifies that the user is not already a friend, does not add themselves, and prevents cross-requests

```py
def respond_friend_request(request, username):
```
* Role: Accepts (`action='accept'`) or rejects (`action='reject'`) an incoming friend request

```py
def remove_friend(request, username):
```
* Role: Removes a friend from the friend list

```py
def get_friend_requests(request):
```
* Role: Retrieves the list of pending incoming friend requests

#### Tournament management

```py
def tournaments(request):
```
* Role: In GET, lists all tournaments. In POST, creates a new tournament (and also stores it on the Blockchain via `service.store_tournament`)

```py
def tournament_detail(request, tid):
```
* Role: Returns the information of a specific tournament

```py
def tournament_blockchain(request, tid):
```
* Role: Retrieves the on-chain data of a specific tournament via its `chain_id`

```py
def join_tournament(request, tid):
```
* Role: Allows a user to join a pending tournament if it is not full

```py
def leave_tournament(request, tid):
```
* Role: Allows a user to leave a tournament, except if they are the creator

```py
def start_tournament(request, tid):
```
* Role: Reserved for the creator: triggers the creation of the tournament bracket via `create_bracket()`

```py
def my_tournament_match(request, tid):
```
* Role: Retrieves the current pending match for the user in a given tournament

#### Utilities / DevOps

```py
def health(request):
```
* Role: Basic endpoint returning `{"status":"ok"}` for Docker health checks

```py
def status_view(request):
```
* Role: Returns the database status and the date of the last backup

### 3. Tournament logic (`tournament_service.py`)
This file manages the competition tree algorithmically.

```py
def _create_round(tournament, round_no, profile_pairs):
```
* Role: Internal function that creates the matches in the database for a given round from player pairs (handles byes if a player has no opponent)

```py
def _check_round_completion(tournament, round_no):
```
* Role: Checks whether all matches of a round are completed. If so, it creates the next round or declares the final winner of the tournament

```py
def create_bracket(tournament):
```
* Role: Initializes the tournament. Randomly shuffles the participants, assigns them a seed, fills in ghost players (`None`) if the number is not a power of two, and creates the first round

```py
def report_result(match, winner_profile):
```
* Role: Validates the winner of a match, eliminates the loser, saves the result on the Blockchain via `service.store_match`, and calls `_check_round_completion()`

### 4. WebSockets and multiplayer game (`routing.py` & `consumers.py`)
WebSockets enable real-time bidirectional communication, which is essential for network Pong. The `ws/pong/` route points to `GameConsumer`.

#### Utility functions

```py
def make_room_name(ch1, ch2):
```
* Role: Generates a unique room identifier (SHA1 hash) based on the names of the two players' channels

```py
def launch_ball(to_right: bool):
```
* Role: Calculates an initial random vector for the ball

```py
def fresh_game():
```
* Role: Returns a dictionary representing the default state of a new game (paddle and ball coordinates, scores)

```py
async def record_stats(winner_uid, loser_uid):
```
* Role: Updates the victory and defeat statistics of profiles in the database asynchronously

```py
async def run_game_loop(room):
```
* Role: This is the heart of the game on the server side. An asynchronous loop running at around 60 FPS (`asyncio.sleep(1 / 60)`). It reads the pressed keys, calculates the ball physics (bounces, scores), and broadcasts (`group_send`) the new state to the room

#### Class `GameConsumer(AsyncWebsocketConsumer)`
This class manages the lifecycle of a WebSocket connection for a player.

```py
async def connect(self):
```
* Role: Accepts the connection and tries to reconnect the player if they were already in an active game

```py
async def disconnect(self, close_code):
```
* Role: Removes the player from the waiting queue. If they are in a game, it pauses the game and starts a grace timer (`RECONNECT_GRACE`) before forfeiting

```py
async def receive(self, text_data):
```
* Role: Routes the actions received from the frontend (`find_match`, `keydown`, `keyup`, `join_tournament_match`, `rematch`)

```py
async def handle_matchmaking(self):
```
* Role: Pairs two players looking for a game. If nobody is available, the player is placed in the queue. If an opponent is found, a room is created and the game starts

### 5. Frontend: AI game loop (`useGameLoops.ts`)
This React TypeScript hook manages a Pong game played locally against an Artificial Intelligence.

```ts
export function useGameLoop(canvasRef: React.RefObject<HTMLCanvasElement | null>, difficulte: AiDifficulty = AiDifficulty.EASY)
```
* Role: Manages the game logic on the client side (unlike multiplayer where the logic is in `consumers.py`)
* Internal methods:

* `syncUI = useCallback(() => {...})`: Synchronizes the game state with the React interface to update the scores
* `draw = useCallback(() => {...})`: Uses the HTML5 Canvas API to draw the field, paddles, ball, and texts depending on the game phase
* `tick = useCallback(() => {...})`: Main loop called by `requestAnimationFrame`. It handles keyboard input for Player 1, calculates the AI movements (Player 2) based on the difficulty level (variable speed factor according to `EASY`, `MEDIUM`, or `HARD`), manages collision physics, and scores
* `handleStart = useCallback(() => {...})`: Starts or restarts the game by changing the game phase and launching the ball
