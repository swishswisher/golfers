using System.Collections.Concurrent;
namespace Clubline;
public sealed class ConnectionRegistry
{
    private readonly ConcurrentDictionary<string, (string UserId, Guid SessionId, Action Abort)> entries = new();
    public void Add(string id, string userId, Guid session, Action abort) => entries[id] = (userId, session, abort);
    public void Remove(string id) => entries.TryRemove(id, out _);
    public IReadOnlyList<string> Active(IReadOnlyCollection<Guid> sessions) => entries.Where(x => sessions.Contains(x.Value.SessionId)).Select(x => x.Key).ToList();
    public void Revoke(Guid session) { foreach (var x in entries.Where(x => x.Value.SessionId == session)) { x.Value.Abort(); entries.TryRemove(x.Key, out _); } }
    public void RevokeUser(string user) { foreach (var x in entries.Where(x => x.Value.UserId == user)) { x.Value.Abort(); entries.TryRemove(x.Key, out _); } }
}
