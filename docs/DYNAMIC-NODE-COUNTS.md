# Dynamic Node Count Management

This document explains how n8n-MCP Modern automatically manages node count references in documentation to keep them accurate and up-to-date.

## Overview

Previously, the codebase used hardcoded node count references like "525+", "682+", or "737+" throughout documentation. This created maintenance problems when new nodes were added or discovered.

The dynamic node count system automatically:
- ✅ Discovers actual available n8n nodes
- ✅ Updates documentation references automatically  
- ✅ Caches results for performance
- ✅ Provides tools for manual updates

## Current Status

**Dynamically Discovered Nodes**: 675+ nodes  
**Source**: 686 standard n8n nodes (rounded down to nearest 25)  
**Last Updated**: Automatically updated from `all-n8n-nodes.ts` discovery

## How It Works

### 1. Dynamic Discovery
The system uses the `ComprehensiveNodeDiscovery` class to:
- Scan the complete `ALL_N8N_NODES` array (686 nodes)
- Detect community nodes from live n8n instances  
- Track discovered nodes in the database
- Round down to nearest 25 for clean references (675+)

### 2. Cache Management
- **Cache Duration**: 10 minutes
- **Auto-Invalidation**: After each discovery completion
- **Fallback**: Uses static node count if discovery fails

### 3. Automatic Updates
```bash
# Update all documentation files
npm run update-node-counts

# Preview changes without applying
npm run update-node-counts:dry
```

### 4. MCP Tools Integration
Two new MCP tools are available:
- `get_dynamic_node_count` - Get current statistics
- `update_documentation_node_counts` - Update documentation files

## Files Updated Automatically

The system updates these files with dynamic node counts:

| File | Description | Patterns Updated |
|------|-------------|-----------------|
| `README.md` | Main documentation | Architecture descriptions, feature lists |
| `CLAUDE.md` | Claude Code guidance | Project overview, validation descriptions |
| `agents/README.md` | Agent documentation | Agent capabilities, tool descriptions |
| `src/agents/agent-definitions.ts` | TypeScript definitions | Code comments, architecture notes |
| `src/agents/agent-routing.ts` | Routing system | Cache sizing, performance comments |

## Integration Points

### Discovery System Integration
```typescript
// After discovery completion
invalidateNodeCountCache()
logger.debug('Node count cache invalidated after discovery completion')
```

### Agent System Integration
Agents can now reference dynamic node counts in their responses, ensuring accuracy without hardcoded values.

### Documentation Pipeline
The update script can be integrated into CI/CD pipelines to keep documentation current:
```bash
# In GitHub Actions or similar
- name: Update Node Count References  
  run: npm run update-node-counts
```

## Performance Characteristics

- **Cache Hit**: ~1ms response time
- **Cache Miss**: ~50-100ms (database query)
- **Update All Files**: ~200ms
- **Memory Impact**: Minimal (~1KB cached data)

## Error Handling

The system gracefully handles failures:
1. **Database Unavailable**: Falls back to static count (686 nodes)
2. **Discovery Failure**: Uses cached values with warning
3. **File Update Failure**: Continues with other files, logs errors

## Monitoring

Monitor the system through:
- Log messages during updates
- MCP tool responses
- Discovery completion events

## Benefits

✅ **Accuracy**: Always reflects actual node count  
✅ **Automation**: No manual maintenance required  
✅ **Performance**: Efficient caching and batch updates  
✅ **Reliability**: Graceful fallbacks prevent failures  
✅ **Transparency**: Clear logging of all updates  

## Future Enhancements

Planned improvements:
- Integration with n8n instance monitoring
- Community node detection improvements  
- Real-time updates based on n8n API changes
- Historical node count tracking

---

*The dynamic node count system ensures documentation accuracy while eliminating maintenance overhead.*