export type PaymentRecord = {
  id?: string | number | null
  amount?: number | string | null
  payment_date?: string | null
  type?: string | null
  description?: string | null
  installment_id?: number | string | null
  reverses_payment_id?: string | null
}

export const isReversalPayment = (payment: PaymentRecord): boolean =>
  String(payment?.type || '').toLowerCase() === 'reversal'

/**
 * IDs dos pagamentos que foram desfeitos por um estorno.
 *
 * O estorno é gravado como uma linha `reversal` em `payments`, mas o pagamento
 * original continua na tabela. Para relatórios financeiros, os dois precisam
 * sair: a entrada não aconteceu de fato.
 *
 * Usa o vínculo explícito (`reverses_payment_id`) quando existe. Para estornos
 * antigos sem vínculo, consome o recebimento de mesmo valor na mesma parcela
 * que ainda não foi excluído — assim o líquido do período continua correto.
 */
export function getReversedPaymentIds(payments: PaymentRecord[]): Set<string> {
  const reversedIds = new Set<string>()

  payments
    .filter(isReversalPayment)
    .forEach((reversal) => {
      if (reversal.reverses_payment_id) {
        reversedIds.add(String(reversal.reverses_payment_id))
        return
      }

      const original = payments
        .filter((candidate) =>
          !isReversalPayment(candidate) &&
          candidate.id != null &&
          !reversedIds.has(String(candidate.id)) &&
          candidate.installment_id != null &&
          String(candidate.installment_id) === String(reversal.installment_id) &&
          Math.abs(Number(candidate.amount || 0)) === Math.abs(Number(reversal.amount || 0))
        )
        .sort((a, b) =>
          new Date(String(b.payment_date || '')).getTime() -
          new Date(String(a.payment_date || '')).getTime()
        )[0]

      if (original?.id != null) reversedIds.add(String(original.id))
    })

  return reversedIds
}

/**
 * Recebimentos que efetivamente compõem o caixa: descarta as linhas de estorno
 * e os pagamentos originais que foram estornados.
 */
export function filterEffectiveReceipts<T extends PaymentRecord>(payments: T[]): T[] {
  const reversedIds = getReversedPaymentIds(payments)

  return payments.filter((payment) =>
    !isReversalPayment(payment) &&
    !(payment.id != null && reversedIds.has(String(payment.id)))
  )
}
