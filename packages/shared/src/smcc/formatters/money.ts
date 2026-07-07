/** 통화 표기 포맷. KR: "15,000원" / EN: "$30" */

export function krw(amount: number): string {
  return `${amount.toLocaleString('en-US')}원`;
}

export function usd(amount: number): string {
  return `$${amount}`;
}
