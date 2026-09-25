'use client'

/** 確認ダイアログを出してからサーバーアクションを実行するボタン */
export function ConfirmSubmit({ action, message, className, children }: { action: () => Promise<void>; message: string; className?: string; children: React.ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault()
      }}
    >
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  )
}
