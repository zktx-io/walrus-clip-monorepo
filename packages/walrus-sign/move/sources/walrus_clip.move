module walrus_clip::verifier_group {
    use sui::dynamic_field as df;
    use std::string;

    const EInvalidCap: u64 = 0;
    const ENotAuthorized: u64 = 1;
    const EAlreadyExists: u64 = 2;
    const ENotFound: u64 = 3;
    const MARKER: u64 = 4;

    /////////////////////////////////////////
    // Structures

    /// A Verifier Group that maintains a list of verifier addresses
    public struct VerifierGroup has key {
        id: object::UID,
        name: string::String,
        verifiers: vector<address>,
    }

    /// Issuer Capability to administer a Verifier Group
    public struct VerifierGroupIssuerCap has key {
        id: object::UID,
        group_id: object::ID,
    }

    /////////////////////////////////////////
    // Create and Destroy

    /// Create a Verifier Group and return an Issuer Cap to administer it
    public fun create(name: string::String, ctx: &mut TxContext): VerifierGroupIssuerCap {
        let group = VerifierGroup {
            id: object::new(ctx),
            name,
            verifiers: vector::empty(),
        };
        let issuer_cap = VerifierGroupIssuerCap {
            id: object::new(ctx),
            group_id: object::id(&group),
        };
        transfer::share_object(group);
        issuer_cap
    }

    /// (Entry) Create and send Issuer Cap to sender
    entry fun create_entry(name: string::String, ctx: &mut TxContext) {
        let issuer_cap = create(name, ctx);
        transfer::transfer(issuer_cap, ctx.sender());
    }

    /// Destroy a Verifier Group and its Issuer Cap
    public fun destroy(group: VerifierGroup, issuer_cap: VerifierGroupIssuerCap) {
        assert!(object::id(&group) == issuer_cap.group_id, EInvalidCap);
        let VerifierGroup { id: group_id, name: _, verifiers: _ } = group;
        let VerifierGroupIssuerCap { id: cap_id, group_id: _ } = issuer_cap;
        object::delete(group_id);
        object::delete(cap_id);
    }

    /////////////////////////////////////////
    // Issuer Operations

    /// Add a verifier address to the group
    public fun add_verifier(group: &mut VerifierGroup, issuer_cap: &VerifierGroupIssuerCap, verifier: address) {
        assert!(object::id(group) == issuer_cap.group_id, EInvalidCap);
        if (contains(&group.verifiers, verifier)) {
            abort EAlreadyExists;
        };
        vector::push_back(&mut group.verifiers, verifier);
    }

    /// Remove a verifier address from the group
    public fun remove_verifier(group: &mut VerifierGroup, issuer_cap: &VerifierGroupIssuerCap, verifier: address) {
        assert!(object::id(group) == issuer_cap.group_id, EInvalidCap);
        let mut i = 0;
        while (i < vector::length(&group.verifiers)) {
            if (vector::borrow(&group.verifiers, i) == &verifier) {
                vector::remove(&mut group.verifiers, i);
                return
            };
            i = i + 1;
        };
        abort ENotFound;
    }

    /////////////////////////////////////////
    // Access Control

    /// Check if caller is in the verifier group
    fun is_verifier(group: &VerifierGroup, addr: address): bool {
        contains(&group.verifiers, addr)
    }

    /// Entry point to approve decrypt access
    entry fun seal_approve(id: vector<u8>, group: &VerifierGroup, ctx: &TxContext) {
        assert!(is_prefix(namespace(group), id), ENotAuthorized);
        assert!(is_verifier(group, ctx.sender()), ENotAuthorized);
    }

    /////////////////////////////////////////
    // Helpers

    /// Get the namespace (prefix) for this group
    public fun namespace(group: &VerifierGroup): vector<u8> {
        object::id(group).to_bytes()
    }

    /// Check if a vector contains an address
    fun contains(vec: &vector<address>, addr: address): bool {
        let mut i = 0;
        while (i < vector::length(vec)) {
            if (vector::borrow(vec, i) == &addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Check if prefix is at the start of word
    fun is_prefix(prefix: vector<u8>, word: vector<u8>): bool {
        if (vector::length(&prefix) > vector::length(&word)) {
            return false
        };
        let mut i = 0;
        while (i < vector::length(&prefix)) {
            if (vector::borrow(&prefix, i) != vector::borrow(&word, i)) {
                return false
            };
            i = i + 1;
        };
        true
    }

}