program cloakclub_four_2026.aleo {
    record Member {
        owner: address,
        community_id: field,
        member_secret: field,
    }

    struct NullifierSeed {
        member_secret: field,
        proposal_id: field,
    }

    mapping community_admin: field => address;
    mapping member_count: field => u64;
    mapping proposal_open: field => bool;
    mapping proposal_community: field => field;
    mapping yes_votes: field => u64;
    mapping no_votes: field => u64;
    mapping used_nullifiers: field => bool;
    mapping post_commitments: field => bool;

    @noupgrade
    constructor() {}

    fn create_community(public community_id: field) -> Final {
        let creator: address = self.caller;
        return final {
            assert(!Mapping::contains(community_admin, community_id));
            Mapping::set(community_admin, community_id, creator);
            Mapping::set(member_count, community_id, 0u64);
        };
    }

    fn issue_membership(
        public community_id: field,
        recipient: address,
        member_secret: field,
    ) -> (Member, Final) {
        let issuer: address = self.caller;
        let membership: Member = Member {
            owner: recipient,
            community_id: community_id,
            member_secret: member_secret,
        };
        return (membership, final {
            let admin: address = Mapping::get(community_admin, community_id);
            assert_eq(admin, issuer);
            let current_members: u64 = Mapping::get_or_use(member_count, community_id, 0u64);
            Mapping::set(member_count, community_id, current_members + 1u64);
        });
    }

    fn publish_post(
        membership: Member,
        public community_id: field,
        public post_commitment: field,
    ) -> (Member, Final) {
        assert_eq(membership.community_id, community_id);
        let renewed_membership: Member = Member {
            owner: membership.owner,
            community_id: membership.community_id,
            member_secret: membership.member_secret,
        };
        return (renewed_membership, final {
            assert(!Mapping::contains(post_commitments, post_commitment));
            Mapping::set(post_commitments, post_commitment, true);
        });
    }

    fn create_proposal(
        public community_id: field,
        public proposal_id: field,
    ) -> Final {
        let creator: address = self.caller;
        return final {
            let admin: address = Mapping::get(community_admin, community_id);
            assert_eq(admin, creator);
            assert(!Mapping::contains(proposal_open, proposal_id));
            Mapping::set(proposal_community, proposal_id, community_id);
            Mapping::set(proposal_open, proposal_id, true);
            Mapping::set(yes_votes, proposal_id, 0u64);
            Mapping::set(no_votes, proposal_id, 0u64);
        };
    }

    fn vote(
        membership: Member,
        public community_id: field,
        public proposal_id: field,
        public choice: bool,
    ) -> (Member, Final) {
        assert_eq(membership.community_id, community_id);
        let seed: NullifierSeed = NullifierSeed {
            member_secret: membership.member_secret,
            proposal_id: proposal_id,
        };
        let nullifier: field = BHP256::hash_to_field(seed);
        let renewed_membership: Member = Member {
            owner: membership.owner,
            community_id: membership.community_id,
            member_secret: membership.member_secret,
        };
        return (renewed_membership, final {
            let is_open: bool = Mapping::get_or_use(proposal_open, proposal_id, false);
            let proposal_owner: field = Mapping::get(proposal_community, proposal_id);
            let already_voted: bool = Mapping::get_or_use(used_nullifiers, nullifier, false);
            assert(is_open);
            assert_eq(proposal_owner, community_id);
            assert(!already_voted);
            Mapping::set(used_nullifiers, nullifier, true);

            if choice {
                let current_yes: u64 = Mapping::get_or_use(yes_votes, proposal_id, 0u64);
                Mapping::set(yes_votes, proposal_id, current_yes + 1u64);
            } else {
                let current_no: u64 = Mapping::get_or_use(no_votes, proposal_id, 0u64);
                Mapping::set(no_votes, proposal_id, current_no + 1u64);
            }
        });
    }
}
