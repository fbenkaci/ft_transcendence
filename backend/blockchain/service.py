import json
from pathlib import Path
from django.conf import settings
from web3 import Web3

_HERE = Path(__file__).resolve().parent
_DEPLOYED = _HERE / "deployed.json"

_w3 = None
_contract = None
_account = None


def _get_contract():
    """Connexion paresseuse : on se connecte une seule fois."""
    global _w3, _contract, _account
    if _contract is not None:
        return _w3, _contract, _account

    data = json.loads(_DEPLOYED.read_text())
    _w3 = Web3(Web3.HTTPProvider(settings.BLOCKCHAIN_RPC))
    _account = _w3.eth.account.from_key(settings.BLOCKCHAIN_PRIVATE_KEY)
    _contract = _w3.eth.contract(
        address=Web3.to_checksum_address(data["address"]),
        abi=data["abi"],
    )
    return _w3, _contract, _account


def _send(fn):
    """Signe et envoie une transaction d'écriture, attend le minage."""
    w3, contract, account = _get_contract()
    tx = fn.build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
    })
    signed = w3.eth.account.sign_transaction(tx, settings.BLOCKCHAIN_PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt.transactionHash.hex()


# ---------- API publique (ce que tes vues appellent) ----------

def store_tournament(tournament_id, name, creator, max_players):
    _, contract, _ = _get_contract()
    fn = contract.functions.createTournament(
        int(tournament_id), str(name), str(creator), int(max_players),
    )
    return _send(fn)


def store_match(tournament_id, match_id, round_no, player1, player2, score1, score2, winner):
    _, contract, _ = _get_contract()
    fn = contract.functions.recordMatch(
        int(tournament_id), int(match_id), int(round_no),
        str(player1), str(player2), int(score1), int(score2), str(winner),
    )
    return _send(fn)


# ---------- Lecture (bonus, pour vérifier) ----------

def get_match_count(tournament_id):
    _, contract, _ = _get_contract()
    return contract.functions.getMatchCount(int(tournament_id)).call()
