export const NEW_TX_EVENT = 'carteira:new-transaction'

export type NewTxDetail = { tipo: 'ENTRADA' | 'SAIDA' }

export function dispatchNewTx(tipo: 'ENTRADA' | 'SAIDA') {
  window.dispatchEvent(new CustomEvent<NewTxDetail>(NEW_TX_EVENT, { detail: { tipo } }))
}
