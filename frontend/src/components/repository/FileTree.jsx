import { useState } from 'react'
import { Spinner } from '../common/Spinner'

function FileIcon({ type, name }) {
  if (type === 'directory') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-400 flex-shrink-0">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    )
  }
  const ext = name.split('.').pop().toLowerCase()
  const iconMap = {
    js: 'text-yellow-400', jsx: 'text-cyan-400', ts: 'text-blue-400', tsx: 'text-blue-400',
    py: 'text-blue-300', java: 'text-orange-400', c: 'text-blue-400', cpp: 'text-purple-400',
    h: 'text-pink-400', hpp: 'text-pink-400', json: 'text-green-400', yml: 'text-red-400',
    yaml: 'text-red-400', md: 'text-surface-400', html: 'text-orange-400', css: 'text-sky-400',
    xml: 'text-orange-300', txt: 'text-surface-500', sh: 'text-lime-400',
  }
  const color = iconMap[ext] || 'text-surface-500'
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`${color} flex-shrink-0`}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

export function FileTree({ tree, selectedPaths, onSelect, onToggle, loading, isSourceFile }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
      </div>
    )
  }

  if (!tree || tree.length === 0) {
    return (
      <p className="text-xs text-surface-600 text-center py-8">No files found</p>
    )
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          selectedPaths={selectedPaths}
          onSelect={onSelect}
          onToggle={onToggle}
          isSourceFile={isSourceFile}
        />
      ))}
    </div>
  )
}

function TreeNode({ node, selectedPaths, onSelect, onToggle, depth = 0, isSourceFile }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const isDir = node.type === 'directory'
  const isSupported = !isDir && isSourceFile(node.path)
  const isChecked = selectedPaths.has(node.path)

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded)
    } else {
      onSelect(node.path)
    }
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
          isChecked
            ? 'bg-accent-600/15'
            : 'hover:bg-surface-800'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {!isDir && isSupported && (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggle(node.path)}
            className="flex-shrink-0 accent-accent-500"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {!isDir && !isSupported && (
          <span className="w-4 flex-shrink-0" />
        )}
        <button
          onClick={handleClick}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          title={node.path}
        >
          {isDir && (
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className={`flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
          {!isDir && <span className="w-[10px] flex-shrink-0" />}
          <FileIcon type={node.type} name={node.name} />
          <span className={`truncate ${isChecked ? 'text-accent-400' : 'text-surface-400'}`}>{node.name}</span>
          {isDir && node.children && (
            <span className="ml-auto text-surface-600 text-[10px]">{node.children.length}</span>
          )}
        </button>
      </div>
      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selectedPaths={selectedPaths}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
              isSourceFile={isSourceFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}
